'use server'

// src/app/dashboard/reservas/actions.ts

import { createClient } from '@/lib/supabase/server'
import { checkClientBlacklist } from '@/lib/checkBlacklist'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type ReservationFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  blacklisted?: boolean
  blacklistReason?: string
}

const ReservationSchema = z.object({
  client_id:  z.string().uuid('Selecciona un cliente'),
  vehicle_id: z.string().uuid('Selecciona un vehículo'),
  start_date: z.string().min(1, 'La fecha de inicio es requerida'),
  end_date:   z.string().min(1, 'La fecha de fin es requerida'),
  notes:      z.string().optional(),
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

  const excludeIds = (blockedIds ?? []).map(r => r.vehicle_id)

  let query = ctx.supabase
    .from('vehicles')
    .select('id, plates, brand, model, year, color')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .order('brand')

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data } = await query
  return data ?? []
}

// ── Crear reserva ─────────────────────────────────────────────────────────────

export async function createReservation(
  _prev: ReservationFormState,
  formData: FormData
): Promise<ReservationFormState> {
  const parsed = ReservationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const { client_id, vehicle_id, start_date, end_date, notes } = parsed.data

  // Validar que end_date > start_date
  if (new Date(end_date) <= new Date(start_date)) {
    return { fieldErrors: { end_date: ['La fecha de fin debe ser posterior a la de inicio'] } }
  }

  // R30 – Verificación de lista negra
  const blacklist = await checkClientBlacklist(client_id)
  if (blacklist.blacklisted) {
    return {
      blacklisted:     true,
      blacklistReason: blacklist.reason,
      error:           'No se puede crear la reserva: el cliente está en la lista negra.',
    }
  }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  // Verificar disponibilidad del vehículo (sin solapamiento)
  const { count } = await ctx.supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .eq('vehicle_id', vehicle_id)
    .not('status', 'in', '("cancelled","completed")')
    .lt('start_date', end_date)
    .gt('end_date', start_date)

  if (count && count > 0) {
    return { fieldErrors: { vehicle_id: ['El vehículo no está disponible para esas fechas'] } }
  }

  // Insertar reserva
  const { data: reservation, error } = await ctx.supabase
    .from('reservations')
    .insert({
      tenant_id:  ctx.tenantId,
      client_id,
      vehicle_id,
      start_date,
      end_date,
      notes:      notes || null,
      created_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !reservation) return { error: error?.message ?? 'Error al crear la reserva' }

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

  // Marcar el vehículo como reservado desde que se crea la reserva
  await ctx.supabase
    .from('vehicles')
    .update({ status: 'reserved', updated_at: new Date().toISOString() })
    .eq('id', vehicle_id)
    .eq('tenant_id', ctx.tenantId)

  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/flota')
  redirect('/dashboard/reservas')
}

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
  }

  revalidatePath('/dashboard/reservas')
  revalidatePath(`/dashboard/reservas/${reservationId}`)
  revalidatePath('/dashboard/flota')
  return { success: true }
}
