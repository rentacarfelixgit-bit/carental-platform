'use server'

// src/app/dashboard/reservas/actions.ts

import { createClient } from '@/lib/supabase/server'
import { checkClientBlacklist } from '@/lib/checkBlacklist'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { rentalFolio } from '@/lib/rentalLabels'
import { parseCalendarReturn, calendarHref } from '@/lib/calendarReturn'
import { randomUUID } from 'crypto'
import { parseBreakdown, computeBreakdown, selectionFromBreakdown, rentalDaysBetween, insuranceColumns } from '@/lib/reservationPrices'

export type ReservationFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  blacklisted?: boolean
  blacklistReason?: string
}

const ReservationSchema = z.object({
  // reservation = reserva normal | walk_in = contrato de mostrador (sin reserva previa)
  origin:       z.enum(['reservation', 'walk_in']).optional().default('reservation'),
  // Vacío = cliente nuevo: se crea con los datos escritos en el formulario
  client_id:    z.string().uuid('Cliente inválido').optional().or(z.literal('')),
  vehicle_id:   z.string().uuid('Selecciona un vehículo'),
  start_date:   z.string().min(1, 'La fecha de inicio es requerida'),
  end_date:     z.string().min(1, 'La fecha de fin es requerida'),
  notes:        z.string().optional(),
  internal_notes: z.string().max(5000, 'Las notas internas son demasiado largas').optional(),
  daily_rate:   z.string().optional(),
  cash_payment: z.string().optional()
    .refine(v => !v || /^\d+(\.\d{1,2})?$/.test(v), 'El abono en efectivo debe ser un monto válido'),
  card_payment: z.string().optional()
    .refine(v => !v || /^\d+(\.\d{1,2})?$/.test(v), 'El abono en tarjeta debe ser un monto válido'),
  total_amount: z.string().optional(),
  payment_method: z.enum(['cash', 'card', 'mixed'], { message: 'Método de pago inválido' }).optional().or(z.literal('')),
  // Seguros
  insurance_cdw_accepted: z.string().optional(),
  insurance_cdw_price:    z.string().optional(),
  insurance_lia_accepted: z.string().optional(),
  insurance_lia_price:    z.string().optional(),
  insurance_tw_accepted:  z.string().optional(),
  insurance_tw_price:     z.string().optional(),
  insurance_at_accepted:  z.string().optional(),
  insurance_at_price:     z.string().optional(),
})

// Datos del cliente editados desde el formulario de reserva (se sincronizan con la tabla clients)
const NAME_RE  = /^[\p{L}\s'.-]+$/u
const DOC_RE   = /^[A-Z0-9-]+$/
const opt = (s: z.ZodString) => s.optional().or(z.literal('')).transform(v => v || null)

const ReservationClientSchema = z.object({
  client_full_name:       z.string().trim().min(1, 'El nombre del cliente es requerido').max(150)
                            .regex(NAME_RE, 'El nombre solo puede contener letras'),
  client_phone_code:      z.string().regex(/^\+\d{1,3}$/, 'Lada inválida').optional(),
  client_phone:           opt(z.string().trim().regex(/^\d{7,15}$/, 'El celular debe tener solo números (7 a 15 dígitos)')),
  client_email:           opt(z.string().trim().email('Email del cliente inválido').max(150)),
  client_license_number:  z.string().trim().max(30).optional().transform(v => v ? v.toUpperCase() : null)
                            .refine(v => !v || DOC_RE.test(v), 'La licencia solo puede tener letras, números y guiones'),
  client_license_expiry:  opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento de licencia inválida')),
  client_passport_number: z.string().trim().max(30).optional().transform(v => v ? v.toUpperCase() : null)
                            .refine(v => !v || DOC_RE.test(v), 'El pasaporte solo puede tener letras, números y guiones'),
  client_passport_expiry: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento de pasaporte inválida')),
  client_address:         opt(z.string().trim().max(200)),
  client_city:            opt(z.string().trim().max(100).regex(NAME_RE, 'La ciudad solo puede contener letras')),
  client_state:           opt(z.string().trim().max(100).regex(NAME_RE, 'El estado solo puede contener letras')),
  client_zip_code:        opt(z.string().trim().regex(/^\d{3,10}$/, 'El código postal debe tener solo números')),
})

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id) return null
  return { supabase, user, tenantId: profile.tenant_id, role: profile.role }
}

// ── Buscar clientes (búsqueda en tiempo real) ────────────────────────────────

export async function searchClients(query: string) {
  const ctx = await getContext()
  if (!ctx) return []

  const q = query.trim()
  if (!q) {
    // Sin query → devolver los primeros 10
    const { data, error } = await ctx.supabase
      .from('clients')
      .select('id, full_name, id_number, phone, email, license_number, license_expiry, passport_number, passport_expiry, address, city, state, zip_code')
      .eq('tenant_id', ctx.tenantId)
      .order('full_name')
      .limit(10)
    if (error) console.error('[searchClients] Error (sin query):', error)
    return data ?? []
  }

  // Buscar por nombre, id_number o license_number (ilike = case-insensitive)
  const { data, error } = await ctx.supabase
    .from('clients')
    .select('id, full_name, id_number, phone, email, license_number, license_expiry, passport_number, passport_expiry, address, city, state, zip_code')
    .eq('tenant_id', ctx.tenantId)
    .or(`full_name.ilike.%${q}%,id_number.ilike.%${q}%,license_number.ilike.%${q}%`)
    .order('full_name')
    .limit(8)

  if (error) console.error('[searchClients] Error:', error)
  return data ?? []
}

// ── Vehículos disponibles para un rango de fechas ────────────────────────────

export async function getAvailableVehicles(startDate: string, endDate: string) {
  const ctx = await getContext()
  if (!ctx) return []

  // Vehículos activos que no tienen reservas activas/pendientes/confirmadas
  // que se solapen con el rango pedido
  const { data: blockedIds } = await ctx.supabase
    .from('reservations')
    .select('vehicle_id')
    .eq('tenant_id', ctx.tenantId)
    .not('status', 'in', '("cancelled","completed")')
    .lt('start_date', endDate)
    .gt('end_date', startDate)

  // Vehículos apartados por un cambio de vehículo en proceso (aún no figuran en ninguna renta)
  const { data: swapTargets } = await ctx.supabase
    .from('reservation_vehicle_swaps')
    .select('to_vehicle_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'in_progress')

  const excludeIds = [
    ...(blockedIds ?? []).map(r => r.vehicle_id),
    ...(swapTargets ?? []).map(r => r.to_vehicle_id),
  ]

  let query = ctx.supabase
    .from('vehicles')
    .select('id, plates, brand, model, year, color, daily_rate')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .not('status', 'in', '("maintenance","retained")')  // bloqueados físicamente
    .order('brand')

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data } = await query
  return data ?? []
}

// ── Datos del cliente desde el formulario de reserva ────────────────────────
// El formulario de reserva sirve tanto para editar un cliente existente
// (se sincroniza su ficha) como para dar de alta uno nuevo.

type Ctx = NonNullable<Awaited<ReturnType<typeof getContext>>>

type ClientRow = {
  full_name: string; phone: string | null; email: string | null
  license_number: string | null; license_expiry: string | null
  passport_number: string | null; passport_expiry: string | null
  address: string | null; city: string | null; state: string | null; zip_code: string | null
}

/** Valida los campos client_* del formulario y los convierte a una fila de la tabla clients. */
function parseClientFields(formData: FormData): { error: ReservationFormState } | { row: ClientRow } {
  const parsed = ReservationClientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors
    const first = Object.values(fe).flat()[0]
    return { error: { error: first ?? 'Datos del cliente inválidos', fieldErrors: fe } }
  }
  const d = parsed.data
  const phone = d.client_phone ? `${d.client_phone_code ?? ''}${d.client_phone}`.trim() || null : null
  const row: ClientRow = {
    full_name:       d.client_full_name,
    phone,
    email:           d.client_email,
    license_number:  d.client_license_number,
    license_expiry:  d.client_license_expiry,
    passport_number: d.client_passport_number,
    passport_expiry: d.client_passport_expiry,
    address:         d.client_address,
    city:            d.client_city,
    state:           d.client_state,
    zip_code:        d.client_zip_code,
  }
  // Mismas reglas que en el módulo de clientes
  if (!row.license_number && !row.passport_number) {
    return { error: { error: 'El cliente debe tener al menos un número de identificación (licencia o pasaporte).' } }
  }
  return { row }
}

/** Revisa que licencia/pasaporte no pertenezcan a otro cliente del tenant. */
async function checkClientDuplicates(
  ctx: Ctx,
  row: ClientRow,
  opts: { excludeId?: string; check: { license: boolean; passport: boolean } }
): Promise<ReservationFormState | null> {
  const hint = opts.excludeId ? '' : ' Búscalo en "Buscar cliente existente" para usarlo en la reserva.'
  if (row.license_number && opts.check.license) {
    let q = ctx.supabase.from('clients').select('full_name')
      .eq('tenant_id', ctx.tenantId).eq('license_number', row.license_number)
    if (opts.excludeId) q = q.neq('id', opts.excludeId)
    const { data: dup } = await q.limit(1).maybeSingle()
    if (dup) return { error: `Ya existe ${opts.excludeId ? 'otro ' : 'un '}cliente con esa licencia: ${dup.full_name}.${hint}` }
  }
  if (row.passport_number && opts.check.passport) {
    let q = ctx.supabase.from('clients').select('full_name')
      .eq('tenant_id', ctx.tenantId).eq('passport_number', row.passport_number)
    if (opts.excludeId) q = q.neq('id', opts.excludeId)
    const { data: dup } = await q.limit(1).maybeSingle()
    if (dup) return { error: `Ya existe ${opts.excludeId ? 'otro ' : 'un '}cliente con ese pasaporte: ${dup.full_name}.${hint}` }
  }
  return null
}

function idFields(row: ClientRow) {
  return {
    id_type:   row.license_number ? 'license' : 'passport',
    id_number: (row.license_number ?? row.passport_number)!,
  }
}

/**
 * Cliente existente: compara lo que llegó del formulario con lo guardado
 * y actualiza su ficha solo si hubo cambios. Devuelve error o null.
 */
async function syncClientFromReservation(
  ctx: Ctx,
  clientId: string,
  formData: FormData
): Promise<ReservationFormState | null> {
  // Si el formulario no mandó los campos del cliente, no tocamos nada
  if (!formData.has('client_full_name')) return null

  const parsed = parseClientFields(formData)
  if ('error' in parsed) return parsed.error
  const next = parsed.row

  const { data: current, error: fetchError } = await ctx.supabase
    .from('clients')
    .select('full_name, phone, email, license_number, license_expiry, passport_number, passport_expiry, address, city, state, zip_code')
    .eq('id', clientId)
    .eq('tenant_id', ctx.tenantId)
    .single()
  if (fetchError || !current) return { error: 'No se encontró el cliente seleccionado' }

  const norm = (v: unknown) => {
    if (v === null || v === undefined) return ''
    return String(v).split('T')[0].replace(/\s+/g, ' ').trim()
  }
  const changed = (Object.keys(next) as (keyof ClientRow)[]).filter(k =>
    k === 'phone'
      ? norm(current.phone).replace(/\s/g, '') !== norm(next.phone).replace(/\s/g, '')
      : norm(current[k]) !== norm(next[k])
  )
  if (changed.length === 0) return null

  const dupError = await checkClientDuplicates(ctx, next, {
    excludeId: clientId,
    check: { license: changed.includes('license_number'), passport: changed.includes('passport_number') },
  })
  if (dupError) return dupError

  const { error } = await ctx.supabase
    .from('clients')
    .update({ ...next, ...idFields(next), updated_at: new Date().toISOString() })
    .eq('id', clientId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: `No se pudieron guardar los datos del cliente: ${error.message}` }

  revalidatePath('/dashboard/clientes')
  revalidatePath(`/dashboard/clientes/${clientId}/editar`)
  return null
}

/** Cliente nuevo: inserta en clients con los datos escritos en la reserva. */
async function insertNewClient(
  ctx: Ctx,
  row: ClientRow
): Promise<{ error: ReservationFormState } | { id: string }> {
  const { data, error } = await ctx.supabase
    .from('clients')
    .insert({
      ...row,
      ...idFields(row),
      tenant_id:  ctx.tenantId,
      created_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') return { error: { error: 'Ya existe un cliente con ese número de identificación.' } }
    return { error: { error: `No se pudo crear el cliente: ${error?.message ?? 'error desconocido'}` } }
  }
  return { id: data.id }
}

// ── Crear reserva ─────────────────────────────────────────────────────────────

export async function createReservation(
  _prev: ReservationFormState,
  formData: FormData
): Promise<ReservationFormState> {
  const parsed = ReservationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const {
    client_id: selectedClientId, origin, vehicle_id, start_date, end_date, notes, internal_notes, total_amount, payment_method,
    cash_payment, card_payment, daily_rate,
    insurance_cdw_accepted, insurance_cdw_price,
    insurance_lia_accepted, insurance_lia_price,
    insurance_tw_accepted,  insurance_tw_price,
    insurance_at_accepted,  insurance_at_price,
  } = parsed.data

  const toPrice = (v?: string) => v ? parseFloat(v) || null : null
  const toBool  = (v?: string) => v === 'true' ? true : v === 'false' ? false : null

  // Desglose de precios (seguros, extras, impuestos, otros). Se recalcula aquí con los días
  // reales y la tarifa enviada: el total guardado siempre coincide con el desglose.
  const sentBreakdown = parseBreakdown(formData.get('price_breakdown')?.toString() ?? '')
  const breakdown = sentBreakdown
    ? computeBreakdown({
        ...selectionFromBreakdown(sentBreakdown),
        days: rentalDaysBetween(start_date, end_date),
        dailyRate: toPrice(daily_rate) ?? sentBreakdown.daily_rate,
      })
    : null

  // Validar que end_date > start_date
  if (new Date(end_date) <= new Date(start_date)) {
    return { fieldErrors: { end_date: ['La fecha de fin debe ser posterior a la de inicio'] } }
  }

  const isNewClient = !selectedClientId
  const isWalkIn    = origin === 'walk_in'

  // R30 – Verificación de lista negra (solo aplica a clientes existentes)
  const blacklist = isNewClient ? { blacklisted: false as const, reason: undefined } : await checkClientBlacklist(selectedClientId)
  if (blacklist.blacklisted) {
    return {
      blacklisted:     true,
      blacklistReason: blacklist.reason,
      error:           'No se puede crear la reserva: el cliente está en la lista negra.',
    }
  }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  // Cliente nuevo → validar sus datos antes de tocar la base
  let newClientRow: ClientRow | null = null
  if (isNewClient) {
    if (!formData.get('client_full_name')?.toString().trim()) {
      return { fieldErrors: { client_id: ['Busca un cliente existente o escribe los datos del cliente nuevo'] } }
    }
    const parsedClient = parseClientFields(formData)
    if ('error' in parsedClient) return parsedClient.error
    const dupError = await checkClientDuplicates(ctx, parsedClient.row, { check: { license: true, passport: true } })
    if (dupError) return dupError
    newClientRow = parsedClient.row
  }

  // Verificar disponibilidad del vehículo y del cliente en paralelo
  const [{ count: vehicleCount }, { count: clientCount }] = await Promise.all([
    ctx.supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('vehicle_id', vehicle_id)
      .not('status', 'in', '("cancelled","completed")')
      .lt('start_date', end_date)
      .gt('end_date', start_date),
    // Un cliente nuevo no puede tener reservas encimadas
    isNewClient
      ? Promise.resolve({ count: 0 })
      : ctx.supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', ctx.tenantId)
          .eq('client_id', selectedClientId)
          .not('status', 'in', '("cancelled","completed")')
          .lt('start_date', end_date)
          .gt('end_date', start_date),
  ])

  if (vehicleCount && vehicleCount > 0) {
    return { fieldErrors: { vehicle_id: ['El vehículo no está disponible para esas fechas'] } }
  }

  if (clientCount && clientCount > 0) {
    return { fieldErrors: { client_id: ['Este cliente ya tiene una reserva activa en esas fechas'] } }
  }

  // Cliente: crear el nuevo o guardar en su ficha lo que se haya editado
  let client_id: string
  if (newClientRow) {
    const created = await insertNewClient(ctx, newClientRow)
    if ('error' in created) return created.error
    client_id = created.id
  } else {
    client_id = selectedClientId!
    const clientSyncError = await syncClientFromReservation(ctx, client_id, formData)
    if (clientSyncError) return clientSyncError
  }

  // Insertar reserva
  const insertPayload: Record<string, unknown> = {
      tenant_id:    ctx.tenantId,
      client_id,
      vehicle_id,
      origin,
      // El contrato de mostrador no necesita confirmación: el cliente ya está ahí.
      // Nace en "confirmed" (contrato abierto) y pasa a "active" con la inspección de salida.
      ...(isWalkIn ? {
        status:       'confirmed',
        confirmed_by: ctx.user.id,
        confirmed_at: new Date().toISOString(),
      } : {}),
      start_date,
      end_date,
      notes:        notes || null,
      internal_notes: internal_notes?.trim() || null,
      cash_payment: toPrice(cash_payment),
      card_payment: toPrice(card_payment),
      daily_rate:   toPrice(daily_rate),
      total_amount: breakdown ? breakdown.total : total_amount ? parseFloat(total_amount) : null,
      price_breakdown: breakdown,
      payment_method: payment_method || null,
      insurance_cdw_accepted: toBool(insurance_cdw_accepted),
      insurance_cdw_price:    toPrice(insurance_cdw_price),
      insurance_lia_accepted: toBool(insurance_lia_accepted),
      insurance_lia_price:    toPrice(insurance_lia_price),
      insurance_tw_accepted:  toBool(insurance_tw_accepted),
      insurance_tw_price:     toPrice(insurance_tw_price),
      insurance_at_accepted:  toBool(insurance_at_accepted),
      insurance_at_price:     toPrice(insurance_at_price),
      ...(breakdown ? insuranceColumns(breakdown) : {}),
      created_by:   ctx.user.id,
      updated_at:   new Date().toISOString(),
    }
  let { data: reservation, error } = await ctx.supabase
    .from('reservations').insert(insertPayload).select('id').single()
  // Si aún no se aplicó el script SQL del desglose, guardar sin esa columna (el total sí se guarda)
  if (error && /price_breakdown/.test(error.message)) {
    delete insertPayload.price_breakdown
    ;({ data: reservation, error } = await ctx.supabase
      .from('reservations').insert(insertPayload).select('id').single())
  }

  if (error || !reservation) {
    // Si el cliente se creó en este mismo intento, lo quitamos para no dejarlo huérfano.
    // (RLS no permite DELETE en clients, por eso se usa el cliente admin, limitado a este id y tenant.)
    if (newClientRow) {
      try {
        await createAdminClient().from('clients').delete().eq('id', client_id).eq('tenant_id', ctx.tenantId)
      } catch { /* si falla la limpieza, el cliente queda creado y se puede reutilizar */ }
    }
    return { error: error?.message ?? 'Error al crear la reserva' }
  }

  // Insertar extras si los hay
  const extraTypes = formData.getAll('extras') as string[]
  const customExtra = formData.get('custom_extra') as string

  const extrasToInsert = extraTypes
    .filter(t => t !== 'custom')
    .map(extra_type => ({ reservation_id: reservation.id, extra_type }))

  if (extraTypes.includes('custom') && customExtra?.trim()) {
    extrasToInsert.push({
      reservation_id: reservation.id,
      extra_type: 'custom',
      description: customExtra.trim(),
    } as never)
  }

  if (extrasToInsert.length > 0) {
    await ctx.supabase.from('reservation_extras').insert(extrasToInsert)
  }

  // Marcar el vehículo como reservado — solo si no tiene estado fijado manualmente por admin
  await ctx.supabase
    .from('vehicles')
    .update({ status: 'reserved', updated_at: new Date().toISOString() })
    .eq('id', vehicle_id)
    .eq('tenant_id', ctx.tenantId)
    .eq('status_locked', false)

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/contratos')
  revalidatePath('/dashboard/flota')
  if (newClientRow) revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/reservas/calendario')
  // Creado desde el calendario → regresar a la misma vista (mes o día). Se arma la URL con
  // parámetros validados, nunca con una URL que venga del formulario.
  const calReturn = parseCalendarReturn({
    from:  formData.get('cal_from')?.toString(),
    mes:   formData.get('cal_mes')?.toString(),
    dia:   formData.get('cal_dia')?.toString(),
    vista: formData.get('cal_vista')?.toString(),
  })
  if (calReturn) redirect(calendarHref(calReturn))
  // Contrato: ir directo al detalle para tomar las fotos de salida y entregar el vehículo
  redirect(isWalkIn ? `/dashboard/reservas/${reservation.id}` : '/dashboard/reservas')
}

// ¿Hay un cambio de vehículo a medias? (no se puede cerrar ni cancelar la renta mientras tanto)
async function hasOpenVehicleSwap(ctx: Ctx, reservationId: string) {
  const { count } = await ctx.supabase.from('reservation_vehicle_swaps')
    .select('id', { count: 'exact', head: true })
    .eq('reservation_id', reservationId).eq('tenant_id', ctx.tenantId).eq('status', 'in_progress')
  return (count ?? 0) > 0
}
const OPEN_SWAP_ERROR = 'Hay un cambio de vehículo en proceso. Termínalo (o cancélalo) antes de cerrar la renta.'

// ── Cambiar estado ────────────────────────────────────────────────────────────

type AllowedStatus = 'confirmed' | 'active' | 'completed' | 'cancelled'

const STATUS_TRANSITIONS: Record<string, AllowedStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active:    ['completed'],
  completed: [],
  cancelled: [],
}

export async function changeReservationStatus(reservationId: string, newStatus: AllowedStatus) {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  // Verificar la reserva existe y el estado actual permite la transición
  const { data: res } = await ctx.supabase
    .from('reservations')
    .select('status')
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!res) return { error: 'Reserva no encontrada' }

  const allowed = STATUS_TRANSITIONS[res.status] ?? []
  if (!allowed.includes(newStatus)) {
    return { error: `No se puede cambiar de ${res.status} a ${newStatus}` }
  }

  if ((newStatus === 'completed' || newStatus === 'cancelled') && await hasOpenVehicleSwap(ctx, reservationId)) {
    return { error: OPEN_SWAP_ERROR }
  }

  // Confirmar requiere ser admin
  if (newStatus === 'confirmed' && ctx.role !== 'admin') {
    return { error: 'Solo los administradores pueden confirmar reservas' }
  }

  // Obtener vehicle_id para sincronizar estado del vehículo
  const { data: fullRes } = await ctx.supabase
    .from('reservations')
    .select('vehicle_id')
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)
    .single()

  const updateData: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'confirmed') {
    updateData.confirmed_by = ctx.user.id
    updateData.confirmed_at = new Date().toISOString()
  }

  const { error } = await ctx.supabase
    .from('reservations')
    .update(updateData)
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: error.message }

  // Sincronizar estado del vehículo con el estado de la reserva
  if (fullRes?.vehicle_id) {
    const vehicleStatus =
      newStatus === 'confirmed'  ? 'reserved'  :
      newStatus === 'active'     ? 'in_use'    :
      /* completed | cancelled */  'available'

    await ctx.supabase
      .from('vehicles')
      .update({ status: vehicleStatus, updated_at: new Date().toISOString() })
      .eq('id', fullRes.vehicle_id)
      .eq('tenant_id', ctx.tenantId)
      .eq('status_locked', false)  // no pisar estado fijado manualmente por admin
  }

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/contratos')
  revalidatePath(`/dashboard/reservas/${reservationId}`)
  revalidatePath('/dashboard/flota')
  return { success: true }
}

// ── Inspección rápida (sin fotos) + cambio de estado ─────────────────────────
// Usado cuando el usuario elige "continuar sin nuevas fotos" al marcar en curso/completada.

const VALID_FUEL_QUICK = ['full', 'three_quarters', 'half', 'quarter', 'empty'] as const

export async function createQuickInspection(
  reservationId: string,
  type: 'checkout' | 'checkin',
  odometer: number,
  fuelLevel: string,
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  if (!(VALID_FUEL_QUICK as readonly string[]).includes(fuelLevel))
    return { error: 'Nivel de combustible inválido' }
  if (!Number.isInteger(odometer) || odometer <= 0)
    return { error: 'El odómetro debe ser un número entero positivo' }

  // Verificar que la reserva pertenece al tenant
  const { data: reservation } = await ctx.supabase
    .from('reservations')
    .select('status, vehicle_id')
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!reservation) return { error: 'Reserva no encontrada' }
  if (reservation.status === 'cancelled') return { error: 'No se pueden agregar inspecciones a reservas canceladas' }
  if (type === 'checkin' && await hasOpenVehicleSwap(ctx, reservationId)) return { error: OPEN_SWAP_ERROR }

  // Insertar inspección sin fotos
  const { error: insErr } = await ctx.supabase.from('inspections').insert({
    id:             randomUUID(),
    reservation_id: reservationId,
    tenant_id:      ctx.tenantId,
    type,
    odometer,
    fuel_level:     fuelLevel,
    inspector_id:   ctx.user.id,
    vehicle_id:     reservation.vehicle_id,
  })

  if (insErr) {
    // 23505 = unique constraint: ya existe inspección de este tipo
    if (insErr.code === '23505') {
      // Si ya existe, actualizar odómetro y combustible
      await ctx.supabase
        .from('inspections')
        .update({ odometer, fuel_level: fuelLevel })
        .eq('reservation_id', reservationId)
        .eq('tenant_id', ctx.tenantId)
        .eq('type', type)
        .is('swap_id', null)   // solo la inspección principal, no las de un cambio de vehículo
    } else {
      return { error: insErr.message }
    }
  }

  // Sincronizar estados (misma lógica que changeReservationStatus)
  const newStatus: AllowedStatus = type === 'checkout' ? 'active' : 'completed'
  const vehicleStatus            = type === 'checkout' ? 'in_use' : 'available'

  await Promise.all([
    ctx.supabase
      .from('reservations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', reservationId)
      .eq('tenant_id', ctx.tenantId),
    reservation.vehicle_id
      ? ctx.supabase
          .from('vehicles')
          .update({ status: vehicleStatus, updated_at: new Date().toISOString() })
          .eq('id', reservation.vehicle_id)
          .eq('tenant_id', ctx.tenantId)
          .eq('status_locked', false)
      : Promise.resolve(),
  ])

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/contratos')
  revalidatePath(`/dashboard/reservas/${reservationId}`)
  revalidatePath(`/dashboard/reservas/${reservationId}/inspecciones`)
  revalidatePath('/dashboard/flota')
  return { success: true }
}

// ── Cambiar fecha de regreso (extender / adelantar) ──────────────────────────
// Recalcula los días, sugiere el nuevo total (editable, con motivo si se ajusta a mano),
// valida que el vehículo siga libre y deja registro en reservation_changes + agenda.

const MS_DAY = 1000 * 60 * 60 * 24
const rentalDays = (start: string, end: string) =>
  Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / MS_DAY))
const round2 = (n: number) => Math.round(n * 100) / 100

export type ReturnDatePreview = {
  error?: string
  oldDays?: number
  newDays?: number
  oldTotal?: number | null
  suggestedTotal?: number | null
  /** Tarifa promedio por día usada para sugerir el total */
  perDay?: number | null
  conflict?: string
}

async function loadRentalForReturnChange(ctx: Ctx, reservationId: string) {
  const { data } = await ctx.supabase
    .from('reservations')
    .select('id, status, origin, start_date, end_date, total_amount, daily_rate, vehicle_id')
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)
    .single()
  return data
}

/** Busca otra renta o bloqueo del mismo vehículo que choque con el nuevo periodo */
async function findReturnDateConflict(ctx: Ctx, r: { id: string; vehicle_id: string; start_date: string }, newEnd: string) {
  const [{ data: overlap }, { data: blocks }] = await Promise.all([
    ctx.supabase
      .from('reservations')
      .select('number, origin, start_date, clients ( full_name )')
      .eq('tenant_id', ctx.tenantId)
      .eq('vehicle_id', r.vehicle_id)
      .neq('id', r.id)
      .not('status', 'in', '("cancelled","completed")')
      .lt('start_date', newEnd)
      .gt('end_date', r.start_date)
      .order('start_date')
      .limit(1),
    ctx.supabase
      .from('vehicle_blocks')
      .select('start_date, reason')
      .eq('tenant_id', ctx.tenantId)
      .eq('vehicle_id', r.vehicle_id)
      .lt('start_date', newEnd)
      .gt('end_date', r.start_date)
      .limit(1),
  ])
  if (overlap?.length) {
    const o = overlap[0]
    const c = o.clients as unknown as { full_name: string } | null
    const kind = o.origin === 'walk_in' ? 'el contrato' : 'la reserva'
    return `El vehículo ya está apartado por ${kind} ${rentalFolio(o.origin, o.number)}${c ? ` (${c.full_name})` : ''} desde el ${new Date(o.start_date).toLocaleDateString('es-MX')}.`
  }
  if (blocks?.length) {
    return `El vehículo tiene un bloqueo desde el ${new Date(blocks[0].start_date).toLocaleDateString('es-MX')}.`
  }
  return null
}

function suggestTotal(r: { start_date: string; end_date: string; total_amount: number | null; daily_rate: number | null }, newEnd: string) {
  const oldDays = rentalDays(r.start_date, r.end_date)
  const newDays = rentalDays(r.start_date, newEnd)
  const oldTotal = r.total_amount != null ? Number(r.total_amount) : null
  // Promedio por día de lo cobrado (incluye seguros e impuestos); si no hay total, la tarifa diaria
  const perDay = oldTotal != null ? oldTotal / oldDays : r.daily_rate != null ? Number(r.daily_rate) : null
  const suggested = oldTotal != null
    ? round2(oldTotal + (newDays - oldDays) * (perDay ?? 0))
    : perDay != null ? round2(perDay * newDays) : null
  return { oldDays, newDays, oldTotal, perDay: perDay != null ? round2(perDay) : null, suggested }
}

export async function previewReturnDateChange(reservationId: string, newEnd: string): Promise<ReturnDatePreview> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const r = await loadRentalForReturnChange(ctx, reservationId)
  if (!r) return { error: 'Renta no encontrada' }
  if (!newEnd || isNaN(new Date(newEnd).getTime())) return { error: 'Fecha inválida' }
  if (new Date(newEnd) <= new Date(r.start_date)) return { error: 'El regreso debe ser posterior a la salida' }

  const s = suggestTotal(r, newEnd)
  const conflict = await findReturnDateConflict(ctx, r, newEnd)
  return {
    oldDays: s.oldDays, newDays: s.newDays, oldTotal: s.oldTotal,
    suggestedTotal: s.suggested, perDay: s.perDay, conflict: conflict ?? undefined,
  }
}

export async function changeReturnDate(
  reservationId: string,
  newEnd: string,
  newTotal: number | null,
  reason: string,
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const r = await loadRentalForReturnChange(ctx, reservationId)
  if (!r) return { error: 'Renta no encontrada' }
  if (!['pending', 'confirmed', 'active'].includes(r.status)) {
    return { error: 'Solo se puede cambiar el regreso de una renta pendiente, confirmada o en uso.' }
  }
  if (!newEnd || isNaN(new Date(newEnd).getTime())) return { error: 'Fecha inválida' }
  if (new Date(newEnd) <= new Date(r.start_date)) return { error: 'El regreso debe ser posterior a la salida' }
  if (new Date(newEnd).getTime() === new Date(r.end_date).getTime()) return { error: 'La fecha de regreso es la misma' }
  if (newTotal != null && (!Number.isFinite(newTotal) || newTotal < 0)) return { error: 'Total inválido' }

  const conflict = await findReturnDateConflict(ctx, r, newEnd)
  if (conflict) return { error: conflict }

  const s = suggestTotal(r, newEnd)
  const finalTotal = newTotal != null ? round2(newTotal) : s.suggested
  const reasonClean = reason.trim()
  const manuallyAdjusted = finalTotal != null && s.suggested != null && Math.abs(finalTotal - s.suggested) >= 0.01
  if (manuallyAdjusted && !reasonClean) {
    return { error: 'Escribe el motivo del ajuste al total (descuento, cortesía, etc.).' }
  }

  const { error } = await ctx.supabase
    .from('reservations')
    .update({ end_date: newEnd, total_amount: finalTotal, updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)
  if (error) return { error: error.message }

  const isExtension = new Date(newEnd) > new Date(r.end_date)
  await ctx.supabase.from('reservation_changes').insert({
    tenant_id:       ctx.tenantId,
    reservation_id:  reservationId,
    type:            'return_date',
    old_end_date:    r.end_date,
    new_end_date:    newEnd,
    old_total:       s.oldTotal,
    suggested_total: s.suggested,
    new_total:       finalTotal,
    reason:          reasonClean || null,
    details:         { old_days: s.oldDays, new_days: s.newDays, per_day: s.perDay, manually_adjusted: manuallyAdjusted, kind: isExtension ? 'extension' : 'early_return' },
    created_by:      ctx.user.id,
  })

  // Dejarlo en la agenda del día del nuevo regreso
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  await ctx.supabase.from('calendar_events').insert({
    tenant_id:      ctx.tenantId,
    type:           'scheduled_return',
    title:          isExtension ? 'Retorno (extensión)' : 'Retorno (adelantado)',
    notes:          `Regreso cambiado del ${fmt(r.end_date)} al ${fmt(newEnd)}.${reasonClean ? ` Motivo: ${reasonClean}` : ''}`,
    event_date:     newEnd.slice(0, 10),
    event_time:     newEnd.length >= 16 ? newEnd.slice(11, 16) : null,
    reservation_id: reservationId,
    created_by:     ctx.user.id,
  })

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/contratos')
  revalidatePath(`/dashboard/reservas/${reservationId}`)
  revalidatePath('/dashboard/reservas/calendario')
  revalidatePath('/dashboard')
  return { success: true }
}
