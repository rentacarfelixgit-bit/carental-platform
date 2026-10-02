'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const currentYear = new Date().getFullYear()

const VehicleSchema = z.object({
  plates:            z.string().trim()
    .min(5, 'Las placas deben tener al menos 5 caracteres')
    .max(20, 'Las placas no pueden exceder 20 caracteres')
    .regex(/^[A-Za-z0-9\-\*]+$/, 'Las placas solo pueden contener letras, números, guion (-) y asterisco (*)')
    .toUpperCase(),
  brand:             z.string().trim().min(1, 'La marca es requerida').max(100, 'La marca no puede exceder 100 caracteres'),
  model:             z.string().trim().min(1, 'El modelo es requerido').max(100, 'El modelo no puede exceder 100 caracteres'),
  year:              z.coerce.number().int().min(1990, 'El año debe ser 1990 o posterior').max(currentYear + 1, `El año no puede ser mayor a ${currentYear + 1}`),
  color:             z.string().trim().min(1, 'El color es requerido').max(50, 'El color no puede exceder 50 caracteres'),
  vin:               z.string().max(17, 'El VIN no puede exceder 17 caracteres').optional(),
  insurance_policy:  z.string().max(100, 'La póliza no puede exceder 100 caracteres').optional(),
  insurance_expiry:  z.string().optional(),
  permit_expiry:     z.string().optional(),
  notes:             z.string().max(2000, 'Las notas no pueden exceder 2,000 caracteres').optional(),
  daily_rate:        z.coerce.number().positive('La tarifa diaria debe ser mayor a 0').optional(),
})

export type VehicleFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  values?: Record<string, string>
  success?: boolean
}

function getSubmittedValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )
}

async function getTenantId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  return data?.tenant_id ?? null
}

async function getTenantAndRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!data?.tenant_id) return null
  return { tenantId: data.tenant_id as string, role: data.role as string }
}

function isAdmin(role: string) {
  return role === 'admin' || role === 'superadmin'
}

// ── Crear vehículo ────────────────────────────────────────────────────────────

export async function createVehicle(
  _prev: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const values = getSubmittedValues(formData)
  const parsed = VehicleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values }

  // daily_rate es obligatorio al crear
  if (!parsed.data.daily_rate) {
    return { fieldErrors: { daily_rate: ['La tarifa diaria es obligatoria.'] }, values }
  }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'No autorizado', values }

  const supabase = await createClient()

  // Verificar placas duplicadas dentro del mismo tenant
  const { data: existing } = await supabase
    .from('vehicles')
    .select('id, brand, model, year')
    .eq('tenant_id', tenantId)
    .eq('plates', parsed.data.plates)
    .maybeSingle()

  if (existing) {
    return {
      error: `Ya existe un vehículo con las placas "${parsed.data.plates}" en la flota: ${existing.brand} ${existing.model} ${existing.year}.`,
      values,
    }
  }

  const { error } = await supabase.from('vehicles').insert({
    ...parsed.data,
    tenant_id:         tenantId,
    daily_rate:        parsed.data.daily_rate,
    updated_at:        new Date().toISOString(),
    vin:               parsed.data.vin || null,
    insurance_policy:  parsed.data.insurance_policy || null,
    insurance_expiry:  parsed.data.insurance_expiry || null,
    permit_expiry:     parsed.data.permit_expiry || null,
    notes:             parsed.data.notes || null,
  })

  if (error) {
    if (error.message.includes('unique') || error.code === '23505')
      return { error: `Ya existe un vehículo con las placas "${parsed.data.plates}".`, values }
    return { error: error.message, values }
  }

  revalidatePath('/dashboard/flota')
  return { success: true }
}

// ── Actualizar vehículo ───────────────────────────────────────────────────────

export async function updateVehicle(
  vehicleId: string,
  _prev: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const values = getSubmittedValues(formData)
  const parsed = VehicleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values }

  const userInfo = await getTenantAndRole()
  if (!userInfo) return { error: 'No autorizado', values }
  const { tenantId, role } = userInfo

  const supabase = await createClient()

  // Verificar que las placas no estén en uso por otro vehículo del tenant
  const { data: existingPlates } = await supabase
    .from('vehicles')
    .select('id, brand, model, year')
    .eq('tenant_id', tenantId)
    .eq('plates', parsed.data.plates)
    .neq('id', vehicleId)
    .maybeSingle()

  if (existingPlates) {
    return {
      error: `Las placas "${parsed.data.plates}" ya están asignadas a: ${existingPlates.brand} ${existingPlates.model} ${existingPlates.year}.`,
      values,
    }
  }

  // daily_rate solo la actualizan admins
  const dailyRateUpdate = isAdmin(role) && parsed.data.daily_rate
    ? { daily_rate: parsed.data.daily_rate }
    : {}

  const { error } = await supabase
    .from('vehicles')
    .update({
      ...parsed.data,
      ...dailyRateUpdate,
      vin:               parsed.data.vin || null,
      insurance_policy:  parsed.data.insurance_policy || null,
      insurance_expiry:  parsed.data.insurance_expiry || null,
      permit_expiry:     parsed.data.permit_expiry || null,
      notes:             parsed.data.notes || null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message, values }

  revalidatePath('/dashboard/flota')
  redirect('/dashboard/flota')
}

// ── Cambiar estado ────────────────────────────────────────────────────────────

// Statuses que solo el admin puede asignar (flujo automático de reservas)
const SYSTEM_STATUSES = ['available', 'reserved', 'in_use']

export async function changeVehicleStatus(vehicleId: string, status: string) {
  const userInfo = await getTenantAndRole()
  if (!userInfo) return { error: 'No autorizado' }

  // Operadores solo pueden poner mantenimiento o retenido
  if (!isAdmin(userInfo.role) && SYSTEM_STATUSES.includes(status)) {
    return { error: 'Solo los administradores pueden asignar ese estado.' }
  }

  const supabase = await createClient()

  // status_locked = true cuando se fija manualmente (cualquier estado excepto disponible devuelto por admin)
  // Cuando el admin pone "disponible" se libera el lock para que el sistema retome el control
  const statusLocked = status !== 'available'

  const { error } = await supabase
    .from('vehicles')
    .update({ status, status_locked: statusLocked, updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
    .eq('tenant_id', userInfo.tenantId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/flota')
  return { success: true }
}

// Verifica si un vehículo tiene una reserva activa (para el warning del admin)
export async function checkVehicleActiveReservation(vehicleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return null

  const { data } = await supabase
    .from('reservations')
    .select('id, status, start_date, end_date, clients(full_name)')
    .eq('tenant_id', profile.tenant_id)
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("cancelled","completed")')
    .order('start_date')
    .limit(1)
    .maybeSingle() as {
      data: {
        id: string; status: string; start_date: string; end_date: string
        clients: { full_name: string } | { full_name: string }[] | null
      } | null
    }

  if (!data) return null

  const clientObj = Array.isArray(data.clients) ? data.clients[0] : data.clients
  return {
    id:           data.id,
    status:       data.status,
    start_date:   data.start_date,
    end_date:     data.end_date,
    client_name:  clientObj?.full_name ?? '—',
  }
}

// ── Importar flota desde Excel ───────────────────────────────────────────────

const currentYearForImport = new Date().getFullYear()

const ImportRowSchema = z.object({
  brand:            z.string().trim().min(1),
  model:            z.string().trim().min(1),
  year:             z.coerce.number().int().min(1990).max(currentYearForImport + 1),
  color:            z.string().trim().min(1),
  plates:           z.string().trim()
    .min(5).max(20)
    .regex(/^[A-Za-z0-9\-\*]+$/)
    .transform(v => v.toUpperCase()),
  daily_rate:       z.coerce.number().positive(),
  vin:              z.string().max(17).optional(),
  insurance_policy: z.string().max(100).optional(),
  insurance_expiry: z.string().optional(),
  permit_expiry:    z.string().optional(),
  notes:            z.string().max(2000).optional(),
})

export async function importVehicles(rows: Record<string, string>[]) {
  const tenantId = await getTenantId()
  if (!tenantId) return { imported: 0, skipped: 0, errors: [{ row: 0, reason: 'No autorizado' }] }

  const supabase = await createClient()

  // Placas existentes en el tenant (para evitar duplicados)
  const { data: existing } = await supabase
    .from('vehicles')
    .select('plates')
    .eq('tenant_id', tenantId)
  const existingPlates = new Set((existing ?? []).map(v => v.plates.toUpperCase()))

  let imported = 0
  let skipped  = 0
  const errors: { row: number; reason: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 6  // offset: plantilla empieza en fila 6
    const raw = rows[i]

    // Saltar filas totalmente vacías
    const requiredEmpty = !raw.brand && !raw.model && !raw.plates
    if (requiredEmpty) { skipped++; continue }

    // Saltar la fila de ejemplo de la plantilla
    const isExampleRow =
      raw.brand?.toLowerCase() === 'toyota' &&
      raw.model?.toLowerCase() === 'corolla' &&
      raw.plates?.toUpperCase() === 'ABC-1234'
    if (isExampleRow) { skipped++; continue }

    const parsed = ImportRowSchema.safeParse(raw)
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((e: { message: string }) => e.message).join(', ')
      errors.push({ row: rowNum, reason: msgs })
      continue
    }

    const d = parsed.data

    // Verificar placa duplicada
    if (existingPlates.has(d.plates)) {
      errors.push({ row: rowNum, reason: `Placas "${d.plates}" ya existen en la flota` })
      skipped++
      continue
    }

    const { error } = await supabase.from('vehicles').insert({
      tenant_id:        tenantId,
      brand:            d.brand,
      model:            d.model,
      year:             d.year,
      color:            d.color,
      plates:           d.plates,
      daily_rate:       d.daily_rate,
      vin:              d.vin || null,
      insurance_policy: d.insurance_policy || null,
      insurance_expiry: d.insurance_expiry || null,
      permit_expiry:    d.permit_expiry || null,
      notes:            d.notes || null,
      status:           'available',
      active:           true,
      updated_at:       new Date().toISOString(),
    })

    if (error) {
      if (error.code === '23505') {
        errors.push({ row: rowNum, reason: `Placas "${d.plates}" ya existen en la flota` })
        skipped++
      } else {
        errors.push({ row: rowNum, reason: error.message })
      }
    } else {
      existingPlates.add(d.plates)
      imported++
    }
  }

  if (imported > 0) revalidatePath('/dashboard/flota')
  return { imported, skipped, errors }
}

// ── Activar / desactivar ──────────────────────────────────────────────────────

export async function toggleVehicleActive(vehicleId: string, active: boolean) {
  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'No autorizado' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/flota')
  return { success: true }
}
