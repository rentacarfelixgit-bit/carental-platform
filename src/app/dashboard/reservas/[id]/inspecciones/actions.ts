'use server'

// src/app/dashboard/reservas/[id]/inspecciones/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const VALID_TYPES      = ['checkout', 'checkin']     as const
const VALID_FUEL       = ['full', 'three_quarters', 'half', 'quarter', 'empty'] as const
const VALID_ZONES      = ['front', 'rear', 'left', 'right', 'top', 'interior'] as const
const VALID_SEVERITIES = ['scratch', 'dent', 'crack', 'missing', 'other']       as const

const InspectionSchema = z.object({
  type:          z.enum(VALID_TYPES),
  inspection_id: z.string().uuid(),
  odometer:      z.coerce.number().int().positive('El odómetro debe ser un número positivo'),
  fuel_level:    z.enum(VALID_FUEL),
  notes:         z.string().optional(),
})

const DamagePointSchema = z.object({
  x_pct:       z.coerce.number().min(0).max(100),
  y_pct:       z.coerce.number().min(0).max(100),
  zone:        z.enum(VALID_ZONES),
  severity:    z.enum(VALID_SEVERITIES),
  description: z.string().optional(),
})

export type InspectionFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

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
  return { supabase, user, tenantId: profile.tenant_id }
}

// Mapa de sincronización de estados al completar una inspección
const INSPECTION_STATUS_SYNC: Record<string, {
  reservationStatus: string
  vehicleStatus: string
}> = {
  checkout: { reservationStatus: 'active',    vehicleStatus: 'in_use'    },
  checkin:  { reservationStatus: 'completed', vehicleStatus: 'available' },
}

export async function createInspection(
  reservationId: string,
  preGeneratedId: string,
  _prev: InspectionFormState,
  formData: FormData
): Promise<InspectionFormState> {
  const parsed = InspectionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  // Verificar que la reserva pertenece al tenant y no está cancelada
  const { data: reservation } = await ctx.supabase
    .from('reservations')
    .select('id, status, vehicle_id')
    .eq('id', reservationId)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (!reservation) return { error: 'Reserva no encontrada' }
  if (reservation.status === 'cancelled') return { error: 'No se pueden agregar inspecciones a reservas canceladas' }

  // Insertar inspección usando el UUID pre-generado (fotos ya subidas con ese ID)
  const { data: inspection, error } = await ctx.supabase
    .from('inspections')
    .insert({
      id:             preGeneratedId,
      reservation_id: reservationId,
      tenant_id:      ctx.tenantId,
      type:           parsed.data.type,
      odometer:       parsed.data.odometer,
      fuel_level:     parsed.data.fuel_level,
      notes:          parsed.data.notes || null,
      inspector_id:   ctx.user.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una inspección de tipo ${parsed.data.type === 'checkout' ? 'entrega' : 'recepción'} para esta reserva.` }
    }
    return { error: error.message }
  }

  // Insertar puntos de daño
  const damageRaw = formData.get('damage_points') as string
  if (damageRaw) {
    try {
      const points = JSON.parse(damageRaw) as unknown[]
      const validPoints = points
        .map(p => DamagePointSchema.safeParse(p))
        .filter(r => r.success)
        .map(r => ({
          ...(r as { success: true; data: z.infer<typeof DamagePointSchema> }).data,
          inspection_id: inspection.id,
        }))
      if (validPoints.length > 0) {
        await ctx.supabase.from('inspection_damage_points').insert(validPoints)
      }
    } catch { /* ignorar JSON inválido */ }
  }

  // Registrar fotos en la tabla inspection_photos
  const photosRaw = formData.get('photo_paths') as string
  if (photosRaw) {
    try {
      const paths = JSON.parse(photosRaw) as string[]
      const validPaths = paths.filter(p => typeof p === 'string' && p.length > 0)
      if (validPaths.length > 0) {
        await ctx.supabase.from('inspection_photos').insert(
          validPaths.map(path => ({
            inspection_id: inspection.id,
            tenant_id:     ctx.tenantId,
            storage_path:  path,
          }))
        )
      }
    } catch { /* ignorar JSON inválido */ }
  }

  // ── Auto-sync de estados ─────────────────────────────────────────────────────
  const sync = INSPECTION_STATUS_SYNC[parsed.data.type]
  if (sync && reservation.vehicle_id) {
    await Promise.all([
      ctx.supabase
        .from('reservations')
        .update({ status: sync.reservationStatus })
        .eq('id', reservationId)
        .eq('tenant_id', ctx.tenantId),
      ctx.supabase
        .from('vehicles')
        .update({ status: sync.vehicleStatus })
        .eq('id', reservation.vehicle_id)
        .eq('tenant_id', ctx.tenantId),
    ])
  }

  revalidatePath(`/dashboard/reservas/${reservationId}`)
  revalidatePath(`/dashboard/reservas/${reservationId}/inspecciones`)
  revalidatePath('/dashboard/flota')
  redirect(`/dashboard/reservas/${reservationId}/inspecciones`)
}
