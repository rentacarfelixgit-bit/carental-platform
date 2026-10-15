'use server'

// src/app/dashboard/reservas/[id]/contractActions.ts
// "Preparar contrato": guarda en la reserva (y en el cliente) todo lo que se captura en el modal,
// para que el contrato impreso — y cualquier reimpresión — muestre exactamente esos datos.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  parseBreakdown, computeBreakdown, selectionFromBreakdown, rentalDaysBetween, insuranceColumns,
} from '@/lib/reservationPrices'

export type ContractDetailsState = { success?: boolean; error?: string; savedAt?: number }

const PAYMENT_VALUES = ['cash', 'card', 'mixed'] as const

export async function saveContractDetails(
  _prev: ContractDetailsState,
  formData: FormData,
): Promise<ContractDetailsState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return { error: 'No autorizado' }
  const tenantId = profile.tenant_id

  const reservationId = formData.get('reservation_id')?.toString() ?? ''
  if (!reservationId) return { error: 'Reserva no encontrada' }

  const cap = (key: string, max: number) => {
    const v = formData.get(key)?.toString().trim() ?? ''
    return v.slice(0, max) || null
  }
  const num = (key: string) => {
    const v = formData.get(key)?.toString().trim() ?? ''
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const { data: r } = await supabase
    .from('reservations')
    .select('id, client_id, start_date, end_date, status')
    .eq('id', reservationId).eq('tenant_id', tenantId).single()
  if (!r) return { error: 'Reserva no encontrada' }

  // ── 1. Dirección del cliente (se guarda en su ficha) ──────────────────────
  if (r.client_id) {
    const { error } = await supabase.from('clients').update({
      address:       cap('address', 200),
      city:          cap('city', 80),
      state:         cap('state', 80),
      zip_code:      cap('zip_code', 20),
      local_phone:   cap('local_phone', 30),
      local_address: cap('local_address', 200),
      updated_at:    new Date().toISOString(),
    }).eq('id', r.client_id).eq('tenant_id', tenantId)
    if (error) return { error: `No se pudo guardar la dirección: ${error.message}` }
  }

  // ── 2. Detalles del contrato ──────────────────────────────────────────────
  const age = num('driver_age')
  if (age !== null && (age < 16 || age > 99)) return { error: 'La edad del conductor debe estar entre 16 y 99 años.' }

  const payment = formData.get('payment_method')?.toString() ?? ''
  const update: Record<string, unknown> = {
    folio:                      cap('folio', 50),
    approval_number:            cap('approval_number', 50),
    prepared_by:                cap('prepared_by', 100),
    additional_driver_license:  cap('d1_lic', 30),
    additional_driver_phone:    cap('d1_tel', 30),
    additional_driver2_license: cap('d2_lic', 30),
    additional_driver2_phone:   cap('d2_tel', 30),
    driver_age:                 age,
    client_has_pets:            formData.get('pets') === '1',
    insurance_deductible:       num('deductible'),
    updated_at:                 new Date().toISOString(),
  }
  if ((PAYMENT_VALUES as readonly string[]).includes(payment)) update.payment_method = payment

  // ── 3. Seguros / extras / impuestos: solo si se modificaron en el modal ──
  // Se recalcula con los días reales para que el total coincida con el desglose.
  if (formData.get('pricing_changed') === '1') {
    const sent = parseBreakdown(formData.get('price_breakdown')?.toString() ?? '')
    if (!sent) return { error: 'No se pudo leer el desglose de precios.' }
    const b = computeBreakdown({ ...selectionFromBreakdown(sent), days: rentalDaysBetween(r.start_date, r.end_date) })
    update.price_breakdown = b
    update.total_amount = b.total
    update.daily_rate = b.daily_rate
    Object.assign(update, insuranceColumns(b))
  }

  const { error } = await supabase.from('reservations').update(update)
    .eq('id', reservationId).eq('tenant_id', tenantId)
  if (error) return { error: `No se pudo guardar el contrato: ${error.message}` }

  revalidatePath(`/dashboard/reservas/${reservationId}`)
  if (r.client_id) revalidatePath(`/dashboard/clientes/${r.client_id}`)
  return { success: true, savedAt: Date.now() }
}
