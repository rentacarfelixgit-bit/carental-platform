'use server'

// src/app/dashboard/reservas/[id]/cambio-vehiculo/actions.ts
// Cambio de vehículo: elegir vehículo, iniciar, cancelar y cerrar al completar las inspecciones.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { SWAP_REASONS, quoteSwap, type SwapQuote, type SwapReason } from '@/lib/vehicleSwap'

type Result = { error?: string; success?: boolean }

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) return null
  return { supabase, user, tenantId: profile.tenant_id as string }
}
type Ctx = NonNullable<Awaited<ReturnType<typeof getContext>>>

function revalidateSwap(reservationId: string) {
  revalidatePath(`/dashboard/reservas/${reservationId}`)
  revalidatePath(`/dashboard/reservas/${reservationId}/cambio-vehiculo`)
  revalidatePath(`/dashboard/reservas/${reservationId}/inspecciones`)
  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/contratos')
  revalidatePath('/dashboard/flota')
  revalidatePath('/dashboard/reservas/calendario')
}

async function loadRental(ctx: Ctx, reservationId: string) {
  const { data } = await ctx.supabase
    .from('reservations')
    .select('id, status, start_date, end_date, total_amount, daily_rate, vehicle_id, vehicles ( id, daily_rate )')
    .eq('id', reservationId).eq('tenant_id', ctx.tenantId).maybeSingle()
  return data
}

export interface SwapCandidate {
  id: string; brand: string; model: string; year: number; plates: string; color: string | null; daily_rate: number | null
}

/** Vehículos libres desde ahora hasta el regreso de la renta */
export async function listSwapCandidates(reservationId: string): Promise<SwapCandidate[]> {
  const ctx = await getContext()
  if (!ctx) return []
  const r = await loadRental(ctx, reservationId)
  if (!r) return []
  const from = new Date().toISOString()

  const [{ data: busy }, { data: openSwaps }, { data: blocks }] = await Promise.all([
    ctx.supabase.from('reservations').select('vehicle_id')
      .eq('tenant_id', ctx.tenantId).neq('id', reservationId)
      .not('status', 'in', '("cancelled","completed")')
      .lt('start_date', r.end_date).gt('end_date', from),
    ctx.supabase.from('reservation_vehicle_swaps').select('to_vehicle_id')
      .eq('tenant_id', ctx.tenantId).eq('status', 'in_progress'),
    ctx.supabase.from('vehicle_blocks').select('vehicle_id')
      .eq('tenant_id', ctx.tenantId).lt('start_date', r.end_date).gt('end_date', from),
  ])
  const exclude = new Set<string>([
    r.vehicle_id,
    ...(busy ?? []).map(x => x.vehicle_id),
    ...(openSwaps ?? []).map(x => x.to_vehicle_id),
    ...(blocks ?? []).map(x => x.vehicle_id),
  ])

  const { data: vehicles } = await ctx.supabase
    .from('vehicles')
    .select('id, brand, model, year, plates, color, daily_rate')
    .eq('tenant_id', ctx.tenantId).eq('active', true)
    .not('status', 'in', '("maintenance","retained","in_use")')
    .order('brand').order('model')
  return (vehicles ?? []).filter(v => !exclude.has(v.id)) as SwapCandidate[]
}

/** Vista previa del precio para un vehículo y motivo */
export async function previewVehicleSwap(reservationId: string, toVehicleId: string, reason: SwapReason): Promise<{ error?: string; quote?: SwapQuote }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const r = await loadRental(ctx, reservationId)
  if (!r) return { error: 'Renta no encontrada' }
  const { data: to } = await ctx.supabase.from('vehicles').select('daily_rate')
    .eq('id', toVehicleId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!to) return { error: 'Vehículo no encontrado' }
  const fromVehicle = r.vehicles as unknown as { daily_rate: number | null } | null
  return {
    quote: quoteSwap({
      startDate: r.start_date, endDate: r.end_date, swapAt: new Date().toISOString(),
      total: r.total_amount, fromRate: r.daily_rate ?? fromVehicle?.daily_rate ?? null, toRate: to.daily_rate,
      keepPrice: SWAP_REASONS[reason]?.keepPrice ?? false,
    }),
  }
}

export async function startVehicleSwap(
  reservationId: string,
  input: { toVehicleId: string; reason: SwapReason; finalTotal: number | null; notes: string },
): Promise<Result & { swapId?: string }> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  if (!SWAP_REASONS[input.reason]) return { error: 'Motivo inválido' }
  const r = await loadRental(ctx, reservationId)
  if (!r) return { error: 'Renta no encontrada' }
  if (r.status !== 'active') return { error: 'Solo se puede cambiar el vehículo de una renta en uso.' }

  const candidates = await listSwapCandidates(reservationId)
  const to = candidates.find(c => c.id === input.toVehicleId)
  if (!to) return { error: 'Ese vehículo ya no está disponible para el resto de la renta.' }

  const keepPrice = SWAP_REASONS[input.reason].keepPrice
  const fromVehicle = r.vehicles as unknown as { daily_rate: number | null } | null
  const fromRate = r.daily_rate ?? fromVehicle?.daily_rate ?? null
  const swapAt = new Date().toISOString()
  const q = quoteSwap({
    startDate: r.start_date, endDate: r.end_date, swapAt,
    total: r.total_amount, fromRate, toRate: to.daily_rate, keepPrice,
  })

  const finalTotal = keepPrice ? q.oldTotal : (input.finalTotal ?? q.suggestedTotal)
  if (finalTotal != null && (!Number.isFinite(finalTotal) || finalTotal < 0)) return { error: 'Total inválido' }
  const adjusted = !keepPrice && finalTotal != null && q.suggestedTotal != null && Math.abs(finalTotal - q.suggestedTotal) >= 0.01
  if (adjusted && !input.notes.trim()) return { error: 'Escribe el motivo del ajuste al total.' }

  const { data: swap, error } = await ctx.supabase.from('reservation_vehicle_swaps').insert({
    tenant_id: ctx.tenantId,
    reservation_id: reservationId,
    from_vehicle_id: r.vehicle_id,
    to_vehicle_id: to.id,
    reason: input.reason,
    keep_price: keepPrice,
    swap_at: swapAt,
    days_used: q.daysUsed,
    days_remaining: q.daysRemaining,
    from_daily_rate: fromRate,
    to_daily_rate: to.daily_rate,
    old_total: q.oldTotal,
    suggested_total: q.suggestedTotal,
    new_total: finalTotal != null ? Math.round(finalTotal * 100) / 100 : null,
    notes: input.notes.trim() || null,
    created_by: ctx.user.id,
  }).select('id').single()
  if (error || !swap) {
    if (error?.code === '23505') return { error: 'Esta renta ya tiene un cambio de vehículo en proceso.' }
    return { error: error?.message ?? 'No se pudo iniciar el cambio' }
  }

  // Apartar el vehículo nuevo mientras se hacen las inspecciones
  await ctx.supabase.from('vehicles')
    .update({ status: 'reserved', updated_at: new Date().toISOString() })
    .eq('id', to.id).eq('tenant_id', ctx.tenantId).eq('status_locked', false)

  revalidateSwap(reservationId)
  return { success: true, swapId: swap.id }
}

export async function cancelVehicleSwap(swapId: string): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const { data: swap } = await ctx.supabase.from('reservation_vehicle_swaps')
    .select('id, reservation_id, to_vehicle_id, status')
    .eq('id', swapId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!swap || swap.status !== 'in_progress') return { error: 'No hay un cambio en proceso' }

  const { count } = await ctx.supabase.from('inspections')
    .select('id', { count: 'exact', head: true }).eq('swap_id', swapId)
  if ((count ?? 0) > 0) {
    return { error: 'Ya se registró una inspección de este cambio; complétalo para no dejar el vehículo sin registro.' }
  }

  await ctx.supabase.from('reservation_vehicle_swaps')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', swapId).eq('tenant_id', ctx.tenantId)
  await ctx.supabase.from('vehicles')
    .update({ status: 'available', updated_at: new Date().toISOString() })
    .eq('id', swap.to_vehicle_id).eq('tenant_id', ctx.tenantId).eq('status', 'reserved').eq('status_locked', false)

  revalidateSwap(swap.reservation_id)
  return { success: true }
}
