'use server'

// src/app/dashboard/flota/[id]/mantenimiento/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const ALERT_TYPES = ['oil_change', 'insurance_renewal', 'tires', 'technical_inspection', 'custom'] as const

const AlertSchema = z.object({
  alert_type:  z.enum(ALERT_TYPES),
  description: z.string().optional(),
  due_date:    z.string().optional(),
  due_km:      z.coerce.number().int().positive().optional().or(z.literal('')),
})

export type AlertFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

async function getAdminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return null
  if (profile.role !== 'admin') return null

  return { supabase, user, tenantId: profile.tenant_id }
}

// ── Crear alerta ──────────────────────────────────────────────────────────────

export async function createMaintenanceAlert(
  vehicleId: string,
  _prev: AlertFormState,
  formData: FormData
): Promise<AlertFormState> {
  const raw = Object.fromEntries(formData)
  const parsed = AlertSchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const ctx = await getAdminContext()
  if (!ctx) return { error: 'Solo los administradores pueden crear alertas.' }

  const { error } = await ctx.supabase
    .from('vehicle_maintenance_alerts')
    .insert({
      vehicle_id:  vehicleId,
      tenant_id:   ctx.tenantId,
      alert_type:  parsed.data.alert_type,
      description: parsed.data.description || null,
      due_date:    parsed.data.due_date || null,
      due_km:      parsed.data.due_km || null,
    })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/flota/${vehicleId}/mantenimiento`)
  revalidatePath('/dashboard/flota')
  return { success: true }
}

// ── Resolver alerta ───────────────────────────────────────────────────────────

export async function resolveMaintenanceAlert(alertId: string, vehicleId: string) {
  const ctx = await getAdminContext()
  if (!ctx) return { error: 'No autorizado' }

  const { error } = await ctx.supabase
    .from('vehicle_maintenance_alerts')
    .update({
      resolved:    true,
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.user.id,
    })
    .eq('id', alertId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/flota/${vehicleId}/mantenimiento`)
  revalidatePath('/dashboard/flota')
  return { success: true }
}
