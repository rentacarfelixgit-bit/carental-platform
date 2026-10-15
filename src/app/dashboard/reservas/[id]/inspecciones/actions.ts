'use server'

// src/app/dashboard/reservas/[id]/inspecciones/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { REQUIRED_INSPECTION_ANGLES, PHOTO_ANGLES, angleLabel } from '@/lib/photoAngles'
import { finalizeVehicleSwapIfComplete } from '@/lib/vehicleSwapFinalize'

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

const InspectionPhotoSchema = z.object({
  path:  z.string().min(1),
  angle: z.enum(PHOTO_ANGLES as [string, ...string[]]),
})

/** Lee las fotos del formulario. Acepta el formato nuevo (photos: {path, angle}[]) y el anterior (photo_paths: string[]). */
function readPhotos(formData: FormData): { path: string; angle: string | null }[] {
  try {
    const raw = formData.get('photos') as string | null
    if (raw) {
      return (JSON.parse(raw) as unknown[])
        .map(p => InspectionPhotoSchema.safeParse(p))
        .filter(r => r.success)
        .map(r => (r as { success: true; data: { path: string; angle: string } }).data)
    }
    const legacy = formData.get('photo_paths') as string | null
    if (legacy) {
      return (JSON.parse(legacy) as unknown[])
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map(path => ({ path, angle: null }))
    }
  } catch { /* JSON inválido → sin fotos */ }
  return []
}

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

  // ¿Es parte de un cambio de vehículo? (recepción del actual / entrega del nuevo)
  const swapIdRaw = (formData.get('swap_id') as string | null) || null
  let swapId: string | null = null
  let inspectedVehicleId: string = reservation.vehicle_id
  if (swapIdRaw) {
    const { data: swap } = await ctx.supabase
      .from('reservation_vehicle_swaps')
      .select('id, status, from_vehicle_id, to_vehicle_id')
      .eq('id', swapIdRaw).eq('reservation_id', reservationId).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!swap || swap.status !== 'in_progress') return { error: 'El cambio de vehículo ya no está en proceso' }
    swapId = swap.id
    inspectedVehicleId = parsed.data.type === 'checkin' ? swap.from_vehicle_id : swap.to_vehicle_id
    if (parsed.data.type === 'checkout') {
      const { data: rec } = await ctx.supabase.from('inspections').select('id')
        .eq('swap_id', swapId).eq('type', 'checkin').maybeSingle()
      if (!rec) return { error: 'Primero registra la recepción del vehículo actual' }
    }
  }

  // La recepción final no puede registrarse con un cambio de vehículo a medias
  if (!swapId && parsed.data.type === 'checkin') {
    const { count: openSwaps } = await ctx.supabase.from('reservation_vehicle_swaps')
      .select('id', { count: 'exact', head: true })
      .eq('reservation_id', reservationId).eq('tenant_id', ctx.tenantId).eq('status', 'in_progress')
    if ((openSwaps ?? 0) > 0) return { error: 'Hay un cambio de vehículo en proceso. Termínalo antes de registrar la recepción final.' }
  }

  // ── Validar fotos (mismas reglas que el formulario) ─────────────────────────
  const photos = readPhotos(formData)
  const { count: baselineCount } = await ctx.supabase
    .from('vehicle_photos')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_id', inspectedVehicleId)
  const hasBaseline   = (baselineCount ?? 0) > 0
  const sameCondition = formData.get('same_condition') as string | null

  if (!hasBaseline) {
    // Sin fotos base: juego completo con los ángulos exteriores obligatorios
    const covered = new Set(photos.map(p => p.angle))
    const missing = REQUIRED_INSPECTION_ANGLES.filter(a => !covered.has(a))
    if (missing.length > 0) {
      return { error: `Faltan fotos de: ${missing.map(a => angleLabel(a)).join(', ')}.` }
    }
  } else if (sameCondition === 'false' && photos.length === 0) {
    return { error: 'Agrega al menos una foto de los cambios detectados en la carrocería.' }
  } else if (sameCondition !== 'true' && sameCondition !== 'false') {
    return { error: 'Indica si el vehículo está en el mismo estado que las fotos registradas.' }
  }

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
      vehicle_id:     inspectedVehicleId,
      swap_id:        swapId,
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

  // Registrar fotos en la tabla inspection_photos (con su ángulo)
  if (photos.length > 0) {
    await ctx.supabase.from('inspection_photos').insert(
      photos.map(p => ({
        inspection_id: inspection.id,
        tenant_id:     ctx.tenantId,
        storage_path:  p.path,
        angle:         p.angle,
      }))
    )
  }

  // ── Cambio de vehículo: no cambia el estado de la renta; se cierra al tener ambas inspecciones
  if (swapId) {
    const finished = await finalizeVehicleSwapIfComplete(ctx.supabase, ctx.tenantId, ctx.user.id, swapId)
    revalidatePath(`/dashboard/reservas/${reservationId}`)
    revalidatePath(`/dashboard/reservas/${reservationId}/inspecciones`)
    revalidatePath(`/dashboard/reservas/${reservationId}/cambio-vehiculo`)
    revalidatePath('/dashboard/reservas')
    revalidatePath('/dashboard/contratos')
    revalidatePath('/dashboard/flota')
    // Cambio terminado → al detalle de la renta (ya con el vehículo nuevo); si falta la entrega → al cambio
    redirect(finished ? `/dashboard/reservas/${reservationId}?cambio=ok` : `/dashboard/reservas/${reservationId}/cambio-vehiculo`)
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
  revalidatePath('/dashboard/contratos')
  revalidatePath('/dashboard/flota')
  redirect(`/dashboard/reservas/${reservationId}/inspecciones`)
}
