'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ALL_PRICE_ITEMS } from '@/lib/reservationPrices'

// ── Guardar datos del negocio ────────────────────────────────────────────────
export async function saveBusinessData(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  // Leer settings actuales para hacer merge (no sobreescribir impuestos u otros campos)
  const { data: tenant } = await supabase
    .from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}

  const settings = {
    ...current,
    company_name: formData.get('company_name')?.toString().trim() ?? '',
    address:      formData.get('address')?.toString().trim() ?? '',
    city:         formData.get('city')?.toString().trim() ?? '',
    phone:        formData.get('phone')?.toString().trim() ?? '',
    phone_2:      formData.get('phone_2')?.toString().trim() ?? '',
    email:        formData.get('email')?.toString().trim() ?? '',
    email_2:      formData.get('email_2')?.toString().trim() ?? '',
    rnc:          formData.get('rnc')?.toString().trim() ?? '',
  }

  const { error } = await supabase
    .from('tenants')
    .update({ settings })
    .eq('id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}

// ── Guardar configuración de impuestos ──────────────────────────────────────
export async function saveTaxSettings(taxes: {
  tax_itbis: boolean
  tax_airport: boolean
  tax_digital: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const { data: tenant } = await supabase
    .from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from('tenants')
    .update({ settings: { ...current, ...taxes } })
    .eq('id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}

// ── Guardar tarifa de un vehículo ────────────────────────────────────────────
export async function saveVehicleRate(vehicleId: string, dailyRate: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('vehicles')
    .update({ daily_rate: dailyRate })
    .eq('id', vehicleId)
    .eq('tenant_id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}

// ── Guardar tarifas de múltiples vehículos ────────────────────────────────────
export async function saveAllVehicleRates(
  entries: { vehicleId: string; dailyRate: number }[]
): Promise<{ success?: boolean; error?: string; failed?: string[] }> {
  if (entries.length === 0) return { success: true }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const results = await Promise.all(
    entries.map(({ vehicleId, dailyRate }) =>
      supabase
        .from('vehicles')
        .update({ daily_rate: dailyRate, updated_at: new Date().toISOString() })
        .eq('id', vehicleId)
        .eq('tenant_id', profile.tenant_id)
        .then(({ error }) => ({ vehicleId, error }))
    )
  )

  const failed = results.filter(r => r.error).map(r => r.vehicleId)
  revalidatePath('/dashboard/configuracion')
  if (failed.length > 0) return { error: `${failed.length} tarifa(s) no pudieron guardarse.`, failed }
  return { success: true }
}

// ── Guardar precios por defecto de seguros, extras e impuestos ───────────────
// Se guardan en tenants.settings.reservation_prices y se precargan en Nueva reserva.
export async function saveReservationPrices(
  prices: Record<string, number>
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  // Validar: solo claves del catálogo, números >= 0, porcentajes <= 100, 2 decimales
  const clean: Record<string, number> = {}
  for (const item of ALL_PRICE_ITEMS) {
    const v = Number(prices[item.key])
    if (!Number.isFinite(v) || v < 0) return { error: `Precio inválido en "${item.label}"` }
    if (item.kind === 'pct' && v > 100) return { error: `"${item.label}" no puede ser mayor a 100%` }
    clean[item.key] = Math.round(v * 100) / 100
  }

  const { data: tenant } = await supabase
    .from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from('tenants')
    .update({ settings: { ...current, reservation_prices: clean } })
    .eq('id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  revalidatePath('/dashboard/reservas/nueva')
  return { success: true }
}
