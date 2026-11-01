'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BUILTIN_ITEMS, KINDS_BY_GROUP, CUSTOM_KEY_RE, MAX_CUSTOM_ITEMS, type CustomPriceItem } from '@/lib/reservationPrices'

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
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) return { error: 'La tarifa diaria debe ser mayor a 0.' }
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
  if (entries.some(e => !Number.isFinite(e.dailyRate) || e.dailyRate <= 0))
    return { error: 'Todas las tarifas deben ser mayores a 0.' }

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
export async function saveReservationPrices(input: {
  prices: Record<string, number>
  custom: CustomPriceItem[]
  hidden: string[]
  /** Conceptos del sistema eliminados */
  deleted?: string[]
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  // ── Conceptos creados por el negocio ──────────────────────────────────────
  if (!Array.isArray(input.custom) || input.custom.length > MAX_CUSTOM_ITEMS)
    return { error: `Máximo ${MAX_CUSTOM_ITEMS} conceptos propios.` }
  const custom: CustomPriceItem[] = []
  const keys = new Set<string>()
  for (const c of input.custom) {
    const label = String(c?.label ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!label) return { error: 'Cada concepto nuevo necesita un nombre.' }
    if (!CUSTOM_KEY_RE.test(String(c.key)) || keys.has(c.key)) return { error: `Concepto inválido: "${label}"` }
    if (!['insurance', 'extra', 'tax'].includes(c.group)) return { error: `Grupo inválido en "${label}"` }
    if (!KINDS_BY_GROUP[c.group].includes(c.kind)) return { error: `Tipo de cobro inválido en "${label}"` }
    keys.add(c.key)
    custom.push({ key: c.key, group: c.group, label, kind: c.kind })
  }
  const deleted = [...new Set((Array.isArray(input.deleted) ? input.deleted : [])
    .filter(k => BUILTIN_ITEMS.some(b => b.key === k)))]
  // Ocultos: conceptos del sistema (no eliminados) o propios que sigan existiendo
  const hidden = [...new Set((Array.isArray(input.hidden) ? input.hidden : [])
    .filter(k => (BUILTIN_ITEMS.some(b => b.key === k) && !deleted.includes(k)) || keys.has(k)))]

  // ── Precios: base + creados; números >= 0, porcentajes <= 100, 2 decimales ─
  const items = [...BUILTIN_ITEMS.filter(b => !deleted.includes(b.key)), ...custom.map(c => ({ ...c, fallback: 0 }))]
  const clean: Record<string, number> = {}
  for (const item of items) {
    const v = Number(input.prices?.[item.key] ?? 0)
    if (!Number.isFinite(v) || v < 0) return { error: `Precio inválido en "${item.label}"` }
    if (item.kind === 'pct' && v > 100) return { error: `"${item.label}" no puede ser mayor a 100%` }
    clean[item.key] = Math.round(v * 100) / 100
  }

  const { data: tenant } = await supabase
    .from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from('tenants')
    .update({ settings: { ...current, reservation_prices: clean, price_catalog: { custom, hidden, deleted } } })
    .eq('id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  revalidatePath('/dashboard/reservas/nueva')
  revalidatePath('/dashboard/contratos/nuevo')
  return { success: true }
}

// ── Moneda: moneda local y tasa de cambio (los precios siempre van en US$) ────
export async function saveCurrencySettings(input: {
  local_code: string; local_symbol: string; local_name: string; exchange_rate: number
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const code   = String(input.local_code ?? '').trim().toUpperCase()
  const symbol = String(input.local_symbol ?? '').trim()
  const name   = String(input.local_name ?? '').trim()
  const rate   = Number(input.exchange_rate)
  if (!/^[A-Z]{3}$/.test(code)) return { error: 'El código de moneda debe tener 3 letras (p. ej. DOP).' }
  if (code === 'USD') return { error: 'La moneda local no puede ser USD: los precios ya van en dólares.' }
  if (!symbol || symbol.length > 6) return { error: 'Escribe el símbolo de la moneda (máx. 6 caracteres).' }
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) return { error: 'La tasa de cambio debe ser mayor a 0.' }

  const { data: tenant } = await supabase
    .from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from('tenants')
    .update({ settings: { ...current, currency: {
      local_code: code, local_symbol: symbol, local_name: name.slice(0, 40),
      exchange_rate: Math.round(rate * 10000) / 10000,
    } } })
    .eq('id', profile.tenant_id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  revalidatePath('/dashboard/reservas/nueva')
  revalidatePath('/dashboard/contratos/nuevo')
  return { success: true }
}

// ── Ubicaciones de Drop off ─────────────────────────────────────────────────
export async function saveDropoffLocations(locations: { code: string; label: string }[]): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return { error: 'Sin permisos' }

  if (!Array.isArray(locations) || locations.length > 40) return { error: 'Máximo 40 ubicaciones.' }
  const clean: { code: string; label: string }[] = []
  for (const l of locations) {
    const label = String(l?.label ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const code = String(l?.code ?? '')
    if (!label) return { error: 'Cada ubicación necesita un nombre.' }
    if (!/^[a-z0-9_]{1,30}$/.test(code) || code === 'otros') return { error: `Ubicación inválida: "${label}"` }
    if (clean.some(c => c.code === code)) continue
    if (clean.some(c => c.label.toLowerCase() === label.toLowerCase())) return { error: `"${label}" está repetida.` }
    clean.push({ code, label })
  }

  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}
  const { error } = await supabase.from('tenants')
    .update({ settings: { ...current, dropoff_locations: clean } }).eq('id', profile.tenant_id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}

// ── Términos y condiciones del contrato + reglas adicionales ────────────────
export async function saveContractTerms(input: {
  text: string
  rules: { id: string; text: string; added_at: string }[]
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return { error: 'Sin permisos' }

  const text = String(input.text ?? '').trim()
  if (text.length > 30000) return { error: 'El texto es demasiado largo (máx. 30,000 caracteres).' }
  if (!Array.isArray(input.rules) || input.rules.length > 50) return { error: 'Máximo 50 reglas adicionales.' }
  const today = new Date().toISOString().slice(0, 10)
  const rules = []
  for (const r of input.rules) {
    const t = String(r?.text ?? '').trim()
    if (!t) return { error: 'Hay una regla adicional vacía: escríbela o quítala.' }
    if (t.length > 2000) return { error: 'Cada regla puede tener máximo 2,000 caracteres.' }
    rules.push({
      id: String(r.id ?? '').slice(0, 40) || `r_${Date.now().toString(36)}`,
      text: t,
      added_at: /^\d{4}-\d{2}-\d{2}$/.test(String(r.added_at)) ? r.added_at : today,
    })
  }

  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', profile.tenant_id).single()
  const current = (tenant?.settings as Record<string, unknown>) ?? {}
  const { error } = await supabase.from('tenants')
    .update({ settings: { ...current, contract_terms: { text, rules } } }).eq('id', profile.tenant_id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}
