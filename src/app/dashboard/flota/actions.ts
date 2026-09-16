'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const currentYear = new Date().getFullYear()

const VehicleSchema = z.object({
  plates:            z.string().trim().min(1, 'Las placas son requeridas').max(20, 'Las placas no pueden exceder 20 caracteres').toUpperCase(),
  brand:             z.string().trim().min(1, 'La marca es requerida').max(100, 'La marca no puede exceder 100 caracteres'),
  model:             z.string().trim().min(1, 'El modelo es requerido').max(100, 'El modelo no puede exceder 100 caracteres'),
  year:              z.coerce.number().int().min(1990, 'El año debe ser 1990 o posterior').max(currentYear + 1, `El año no puede ser mayor a ${currentYear + 1}`),
  color:             z.string().trim().min(1, 'El color es requerido').max(50, 'El color no puede exceder 50 caracteres'),
  vin:               z.string().max(17, 'El VIN no puede exceder 17 caracteres').optional(),
  insurance_policy:  z.string().max(100, 'La póliza no puede exceder 100 caracteres').optional(),
  insurance_expiry:  z.string().optional(),
  permit_expiry:     z.string().optional(),
  notes:             z.string().max(2000, 'Las notas no pueden exceder 2,000 caracteres').optional(),
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

// ── Crear vehículo ────────────────────────────────────────────────────────────

export async function createVehicle(
  _prev: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const values = getSubmittedValues(formData)
  const parsed = VehicleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'No autorizado', values }

  const supabase = await createClient()
  const { error } = await supabase.from('vehicles').insert({
    ...parsed.data,
    tenant_id: tenantId,
    vin:               parsed.data.vin || null,
    insurance_policy:  parsed.data.insurance_policy || null,
    insurance_expiry:  parsed.data.insurance_expiry || null,
    permit_expiry:     parsed.data.permit_expiry || null,
    notes:             parsed.data.notes || null,
  })

  if (error) {
    if (error.message.includes('unique') || error.code === '23505')
      return { error: 'Ya existe un vehículo con esas placas.', values }
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

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'No autorizado', values }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update({
      ...parsed.data,
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

export async function changeVehicleStatus(vehicleId: string, status: string) {
  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'No autorizado' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/flota')
  return { success: true }
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
