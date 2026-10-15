// src/lib/vehicleSwapFinalize.ts
// Cierra un cambio de vehículo cuando ya tiene su recepción (checkin) y su entrega (checkout).
// Se llama desde la acción que guarda inspecciones (servidor).

import type { SupabaseClient } from '@supabase/supabase-js'

export async function finalizeVehicleSwapIfComplete(
  supabase: SupabaseClient, tenantId: string, userId: string, swapId: string,
) {
  const { data: swap } = await supabase.from('reservation_vehicle_swaps')
    .select('id, status, reservation_id, from_vehicle_id, to_vehicle_id, reason, keep_price, old_total, suggested_total, new_total, days_used, days_remaining, from_daily_rate, to_daily_rate, notes, swap_at')
    .eq('id', swapId).eq('tenant_id', tenantId).maybeSingle()
  if (!swap || swap.status !== 'in_progress') return false

  const { data: insp } = await supabase.from('inspections').select('type').eq('swap_id', swapId)
  const types = new Set((insp ?? []).map(i => i.type))
  if (!types.has('checkin') || !types.has('checkout')) return false

  const now = new Date().toISOString()
  const { data: rental } = await supabase.from('reservations').select('end_date')
    .eq('id', swap.reservation_id).eq('tenant_id', tenantId).maybeSingle()

  // La renta queda con el vehículo nuevo (y el nuevo total si el cambio altera precio)
  await supabase.from('reservations').update({
    vehicle_id: swap.to_vehicle_id,
    ...(swap.keep_price ? {} : { total_amount: swap.new_total }),
    updated_at: now,
  }).eq('id', swap.reservation_id).eq('tenant_id', tenantId)

  await Promise.all([
    // El vehículo recibido: a mantenimiento si fue por falla, si no, disponible
    supabase.from('vehicles')
      .update({ status: swap.reason === 'vehicle_issue' ? 'maintenance' : 'available', updated_at: now })
      .eq('id', swap.from_vehicle_id).eq('tenant_id', tenantId).eq('status_locked', false),
    supabase.from('vehicles')
      .update({ status: 'in_use', updated_at: now })
      .eq('id', swap.to_vehicle_id).eq('tenant_id', tenantId).eq('status_locked', false),
    supabase.from('reservation_vehicle_swaps')
      .update({ status: 'completed', completed_at: now })
      .eq('id', swapId).eq('tenant_id', tenantId),
    // Historial de cambios de la renta (documentación)
    supabase.from('reservation_changes').insert({
      tenant_id: tenantId,
      reservation_id: swap.reservation_id,
      type: 'vehicle_change',
      old_end_date: rental?.end_date ?? null,
      new_end_date: rental?.end_date ?? null,
      old_total: swap.old_total,
      suggested_total: swap.suggested_total,
      new_total: swap.keep_price ? swap.old_total : swap.new_total,
      reason: swap.notes,
      details: {
        swap_id: swap.id,
        swap_reason: swap.reason,
        keep_price: swap.keep_price,
        from_vehicle_id: swap.from_vehicle_id,
        to_vehicle_id: swap.to_vehicle_id,
        days_used: swap.days_used,
        days_remaining: swap.days_remaining,
        from_daily_rate: swap.from_daily_rate,
        to_daily_rate: swap.to_daily_rate,
        swap_at: swap.swap_at,
      },
      created_by: userId,
    }),
  ])
  return true
}
