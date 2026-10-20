// src/lib/reservationPrices.ts
// Catálogo de seguros, extras e impuestos de las rentas y sus precios por defecto (en US$).
//
// - Conceptos base (los de siempre) + conceptos que cada negocio crea en Configuración.
// - Se guarda en tenants.settings:
//     reservation_prices: { [key]: precio }           ← precio por defecto de cada concepto
//     price_catalog: { custom: [...], hidden: [...] } ← conceptos creados y conceptos base ocultos
// - Cada renta guarda su desglose (reservations.price_breakdown) con nombre, tipo y precio de cada
//   concepto, así el contrato se imprime igual aunque después se renombre u oculte un concepto.

export type PriceKind = 'per_day' | 'flat' | 'pct'
export type PriceGroup = 'insurance' | 'extra' | 'tax'

export interface PriceItem {
  key: string
  label: string
  kind: PriceKind
  group: PriceGroup
  /** Valor si el admin aún no ha configurado uno */
  fallback: number
  /** Creado por el negocio en Configuración */
  custom?: boolean
}

export const INSURANCE_ITEMS: PriceItem[] = [
  { key: 'cdw', group: 'insurance', label: 'Seg. de Colisión / CDW',          kind: 'per_day', fallback: 0 },
  { key: 'lia', group: 'insurance', label: 'Seg. Daños a 3eros / Liability',  kind: 'per_day', fallback: 0 },
  { key: 'tw',  group: 'insurance', label: 'Seg. Gomas y Cristales / TAW',    kind: 'per_day', fallback: 0 },
  { key: 'at',  group: 'insurance', label: 'Seg. Anti-Robo / Anti-Theft',     kind: 'per_day', fallback: 0 },
  { key: 'pkg', group: 'insurance', label: 'Paq. Básico de Seg. / Lia+TAW',   kind: 'per_day', fallback: 0 },
]

export const EXTRA_ITEMS: PriceItem[] = [
  { key: 'fuel',    group: 'extra', label: 'Combustible / Prepay Gas Tank',     kind: 'flat', fallback: 0 },
  { key: 'carwash', group: 'extra', label: 'Lavado del Vehículo / Car Wash',    kind: 'flat', fallback: 7 },
  { key: 'wifi',    group: 'extra', label: 'Cajita de Internet / WiFi Hotspot', kind: 'flat', fallback: 7 },
  { key: 'carseat', group: 'extra', label: 'Silla de Bebé / Car Seat',          kind: 'flat', fallback: 7 },
]

export const TAX_ITEMS: PriceItem[] = [
  { key: 'vlf',     group: 'tax', label: 'Impuesto de Tránsito / VLF', kind: 'flat', fallback: 5 },
  { key: 'airport', group: 'tax', label: 'Impuesto Aeroportuario',     kind: 'pct',  fallback: 10 },
  { key: 'itbis',   group: 'tax', label: 'Impuesto / ITBIS',           kind: 'pct',  fallback: 18 },
]

/** Conceptos base del sistema */
export const BUILTIN_ITEMS: PriceItem[] = [...INSURANCE_ITEMS, ...EXTRA_ITEMS, ...TAX_ITEMS]
/** @deprecated usar el catálogo del negocio (getPriceCatalog). Se conserva por compatibilidad. */
export const ALL_PRICE_ITEMS: PriceItem[] = BUILTIN_ITEMS

/** Tipos permitidos por grupo (lo que ofrece Configuración al crear un concepto) */
export const KINDS_BY_GROUP: Record<PriceGroup, PriceKind[]> = {
  insurance: ['per_day', 'flat'],
  extra:     ['flat', 'per_day'],
  tax:       ['pct', 'flat'],
}
export const KIND_LABEL: Record<PriceKind, string> = {
  per_day: 'Por día', flat: 'Cargo único', pct: 'Porcentaje',
}
export const GROUP_LABEL: Record<PriceGroup, string> = {
  insurance: 'Seguros', extra: 'Extras', tax: 'Impuestos',
}

export const MAX_CUSTOM_ITEMS = 40
export const CUSTOM_KEY_RE = /^c_[a-z0-9]{4,16}$/

export type ReservationPrices = Record<string, number>

/** Conceptos creados por el negocio (tal como se guardan en settings.price_catalog.custom) */
export interface CustomPriceItem { key: string; group: PriceGroup; label: string; kind: PriceKind }

export interface PriceCatalog {
  insurance: PriceItem[]
  extra: PriceItem[]
  tax: PriceItem[]
  /** Todos, en orden: seguros, extras, impuestos */
  all: PriceItem[]
}

const isGroup = (g: unknown): g is PriceGroup => g === 'insurance' || g === 'extra' || g === 'tax'
const isKind  = (k: unknown): k is PriceKind  => k === 'per_day' || k === 'flat' || k === 'pct'

function settingsObj(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === 'object' ? settings as Record<string, unknown> : {}
}

/** Conceptos creados por el negocio, validados */
export function getCustomItems(settings: unknown): CustomPriceItem[] {
  const cat = settingsObj(settings).price_catalog as Record<string, unknown> | undefined
  const raw = Array.isArray(cat?.custom) ? cat!.custom as unknown[] : []
  const out: CustomPriceItem[] = []
  for (const r of raw) {
    const o = r as Partial<CustomPriceItem>
    if (!o || typeof o.key !== 'string' || !CUSTOM_KEY_RE.test(o.key)) continue
    if (!isGroup(o.group) || !isKind(o.kind) || !KINDS_BY_GROUP[o.group].includes(o.kind)) continue
    const label = String(o.label ?? '').trim().slice(0, 80)
    if (!label) continue
    out.push({ key: o.key, group: o.group, label, kind: o.kind })
  }
  return out.slice(0, MAX_CUSTOM_ITEMS)
}

/** Conceptos base que el negocio eliminó (no aparecen en ningún lado; se pueden restaurar) */
export function getDeletedKeys(settings: unknown): string[] {
  const cat = settingsObj(settings).price_catalog as Record<string, unknown> | undefined
  const raw = Array.isArray(cat?.deleted) ? cat!.deleted as unknown[] : []
  return raw.filter((k): k is string => typeof k === 'string' && BUILTIN_ITEMS.some(b => b.key === k))
}

/** Conceptos que el negocio ocultó (del sistema o propios) */
export function getHiddenKeys(settings: unknown): string[] {
  const cat = settingsObj(settings).price_catalog as Record<string, unknown> | undefined
  const raw = Array.isArray(cat?.hidden) ? cat!.hidden as unknown[] : []
  const customKeys = new Set(getCustomItems(settings).map(c => c.key))
  return raw.filter((k): k is string => typeof k === 'string' && (BUILTIN_ITEMS.some(b => b.key === k) || customKeys.has(k)))
}

export function groupCatalog(items: PriceItem[]): PriceCatalog {
  const insurance = items.filter(i => i.group === 'insurance')
  const extra     = items.filter(i => i.group === 'extra')
  const tax       = items.filter(i => i.group === 'tax')
  return { insurance, extra, tax, all: [...insurance, ...extra, ...tax] }
}

/**
 * Catálogo del negocio: conceptos base (menos los ocultos) + los creados en Configuración.
 * includeHidden = true lo usa Configuración para poder volver a mostrarlos.
 */
export function getPriceCatalog(settings: unknown, opts: { includeHidden?: boolean } = {}): PriceCatalog {
  const hidden = new Set(getHiddenKeys(settings))
  const deleted = new Set(getDeletedKeys(settings))
  const builtins = BUILTIN_ITEMS.filter(i => !deleted.has(i.key) && (opts.includeHidden || !hidden.has(i.key)))
  const custom: PriceItem[] = getCustomItems(settings)
    .filter(c => opts.includeHidden || !hidden.has(c.key))
    .map(c => ({ ...c, fallback: 0, custom: true }))
  return groupCatalog([...builtins, ...custom])
}

/** Precios por defecto de todos los conceptos del negocio (base + creados) */
export function getReservationPrices(settings: unknown): ReservationPrices {
  const saved = settingsObj(settings).reservation_prices as Record<string, unknown> | null | undefined
  const out: ReservationPrices = {}
  for (const item of getPriceCatalog(settings, { includeHidden: true }).all) {
    const raw = saved?.[item.key]
    const v = raw === undefined || raw === null || raw === '' ? NaN : Number(raw)
    out[item.key] = Number.isFinite(v) && v >= 0 ? v : item.fallback
  }
  return out
}

/** Une catálogos sin repetir conceptos (el primero manda). Sirve para que una renta conserve
 *  conceptos que ya no están en el catálogo actual del negocio. */
export function mergeCatalog(primary: PriceItem[], extra: PriceItem[]): PriceCatalog {
  const seen = new Set(primary.map(i => i.key))
  return groupCatalog([...primary, ...extra.filter(i => !seen.has(i.key))])
}

// ─────────────────────────────────────────────────────────────────────────────
// Desglose de precios de una renta
// Se calcula igual en Nueva reserva, en "Preparar contrato" y en el servidor, y se guarda
// en reservations.price_breakdown para que el contrato muestre exactamente lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

export type BreakdownGroup = PriceGroup | 'other'

export interface BreakdownLine {
  key: string
  group: BreakdownGroup
  label: string
  kind: PriceKind
  /** Precio capturado: por día, fijo o porcentaje según kind */
  price: number
  /** Marcado/aceptado. En seguros: false = declinado */
  checked: boolean
  /** Importe que suma al total (0 si no está marcado) */
  amount: number
}

export interface PriceBreakdown {
  v: 1
  days: number
  daily_rate: number
  rental_subtotal: number
  insurance_total: number
  extras_total: number
  /** Renta + seguros + extras + otros */
  subtotal: number
  taxes_total: number
  total: number
  lines: BreakdownLine[]
}

export interface PriceSelection {
  days: number
  dailyRate: number
  checked: Record<string, boolean>
  prices: Record<string, number>
  otros?: { label: string; price: number; checked: boolean }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Cálculo único de la renta.
 * Seguros y extras: por día (precio × días) o cargo único. Impuestos: porcentaje sobre
 * renta + seguros (igual que siempre), cargo único o por día.
 */
export function computeBreakdown(sel: PriceSelection, items: PriceItem[] = BUILTIN_ITEMS): PriceBreakdown {
  const days = Math.max(0, Math.floor(sel.days))
  const dailyRate = Math.max(0, sel.dailyRate || 0)
  const price = (k: string) => Math.max(0, Number(sel.prices[k]) || 0)
  const rental = dailyRate * days
  const cat = groupCatalog(items)
  const lines: BreakdownLine[] = []
  const amountOf = (it: PriceItem, base: number) =>
    it.kind === 'per_day' ? price(it.key) * days : it.kind === 'pct' ? base * (price(it.key) / 100) : price(it.key)

  let insurance = 0
  for (const it of cat.insurance) {
    const checked = !!sel.checked[it.key]
    const amount = checked ? amountOf(it, 0) : 0
    insurance += amount
    lines.push({ key: it.key, group: 'insurance', label: it.label, kind: it.kind, price: price(it.key), checked, amount: r2(amount) })
  }
  let extras = 0
  for (const it of cat.extra) {
    const checked = !!sel.checked[it.key]
    const amount = checked ? amountOf(it, 0) : 0
    extras += amount
    lines.push({ key: it.key, group: 'extra', label: it.label, kind: it.kind, price: price(it.key), checked, amount: r2(amount) })
  }
  if (sel.otros && (sel.otros.checked || sel.otros.label.trim())) {
    const amount = sel.otros.checked ? Math.max(0, sel.otros.price || 0) : 0
    extras += amount
    lines.push({ key: 'otros', group: 'other', label: sel.otros.label.trim().slice(0, 80) || 'Otros', kind: 'flat',
      price: Math.max(0, sel.otros.price || 0), checked: sel.otros.checked, amount: r2(amount) })
  }
  const taxBase = rental + insurance
  let taxes = 0
  for (const it of cat.tax) {
    const checked = !!sel.checked[it.key]
    const amount = checked ? amountOf(it, taxBase) : 0
    taxes += amount
    lines.push({ key: it.key, group: 'tax', label: it.label, kind: it.kind, price: price(it.key), checked, amount: r2(amount) })
  }

  return {
    v: 1, days, daily_rate: r2(dailyRate),
    rental_subtotal: r2(rental), insurance_total: r2(insurance), extras_total: r2(extras),
    subtotal: r2(rental + insurance + extras), taxes_total: r2(taxes),
    total: r2(rental + insurance + extras + taxes),
    lines,
  }
}

/** Conceptos (con nombre y tipo) tal como quedaron guardados en un desglose */
export function catalogFromBreakdown(b: PriceBreakdown): PriceItem[] {
  return b.lines
    .filter(l => l.key !== 'otros' && l.group !== 'other')
    .map(l => ({ key: l.key, label: l.label, kind: l.kind, group: l.group as PriceGroup, fallback: 0 }))
}

/** Selección (marcados y precios) a partir de un desglose guardado, para volver a editarlo. */
export function selectionFromBreakdown(b: PriceBreakdown, days = b.days): PriceSelection {
  const checked: Record<string, boolean> = {}
  const prices: Record<string, number> = {}
  let otros: PriceSelection['otros']
  for (const l of b.lines) {
    if (l.key === 'otros') { otros = { label: l.label, price: l.price, checked: l.checked }; continue }
    checked[l.key] = l.checked
    prices[l.key] = l.price
  }
  return { days, dailyRate: b.daily_rate, checked, prices, otros }
}

/**
 * Valida y normaliza un desglose que viene de la base de datos o de un formulario.
 * Conserva los conceptos con su nombre y tipo, pero recalcula todos los importes:
 * nunca se confía en los montos que vienen de fuera.
 */
export function parseBreakdown(raw: unknown): PriceBreakdown | null {
  let obj = raw
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) } catch { return null } }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Partial<PriceBreakdown>
  if (o.v !== 1 || !Array.isArray(o.lines)) return null

  const sel: PriceSelection = { days: Number(o.days) || 0, dailyRate: Number(o.daily_rate) || 0, checked: {}, prices: {} }
  const items: PriceItem[] = []
  const seen = new Set<string>()
  for (const l of (o.lines as Partial<BreakdownLine>[]).slice(0, 80)) {
    if (!l || typeof l.key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(l.key) || seen.has(l.key)) continue
    seen.add(l.key)
    if (l.key === 'otros') {
      sel.otros = { label: String(l.label ?? 'Otros').slice(0, 80), price: Number(l.price) || 0, checked: !!l.checked }
      continue
    }
    if (!isGroup(l.group) || !isKind(l.kind)) continue
    const builtin = BUILTIN_ITEMS.find(b => b.key === l.key)
    const label = String(l.label ?? builtin?.label ?? '').trim().slice(0, 80)
    if (!label) continue
    items.push({ key: l.key, group: l.group, kind: l.kind, label, fallback: 0 })
    sel.checked[l.key] = !!l.checked
    sel.prices[l.key] = Number(l.price) || 0
  }
  return computeBreakdown(sel, items)
}

/** Para reservas anteriores al desglose: lo arma con las columnas de seguros que sí existían. */
export function legacyBreakdown(r: {
  days: number; daily_rate: number | null; total_amount: number | null
  insurance: Record<'cdw' | 'lia' | 'tw' | 'at', { accepted: boolean | null; price: number | null }>
}): PriceBreakdown {
  const checked: Record<string, boolean> = {}
  const prices: Record<string, number> = {}
  for (const k of ['cdw', 'lia', 'tw', 'at'] as const) {
    checked[k] = !!r.insurance[k].accepted
    prices[k] = Number(r.insurance[k].price) || 0
  }
  const dailyRate = r.daily_rate != null
    ? Number(r.daily_rate)
    : r.total_amount != null && r.days > 0 ? Number(r.total_amount) / r.days : 0
  return computeBreakdown({ days: r.days, dailyRate, checked, prices })
}

/** Días de renta: bloques de 24 h desde la salida (igual en todo el sistema). */
export function rentalDaysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms > 0 ? Math.ceil(ms / 86400000) : 0
}

/** Columnas de seguros de reservations (cdw/lia/tw/at) a partir del desglose, para mantenerlas en sync. */
export function insuranceColumns(b: PriceBreakdown) {
  const out: Record<string, boolean | number | null> = {}
  for (const k of ['cdw', 'lia', 'tw', 'at'] as const) {
    const l = b.lines.find(x => x.key === k)
    out[`insurance_${k}_accepted`] = l ? l.checked : null
    out[`insurance_${k}_price`]    = l && l.checked && l.price > 0 ? l.price : null
  }
  return out
}

/** Columnas extra para resolveBreakdown() (además de start_date, end_date, daily_rate y total_amount) */
export const BREAKDOWN_SELECT =
  'price_breakdown, ' +
  'insurance_cdw_accepted, insurance_cdw_price, insurance_lia_accepted, insurance_lia_price, ' +
  'insurance_tw_accepted, insurance_tw_price, insurance_at_accepted, insurance_at_price'

type BreakdownSource = {
  price_breakdown?: unknown
  daily_rate: number | string | null
  total_amount: number | string | null
  start_date: string
  end_date: string
  insurance_cdw_accepted?: boolean | null; insurance_cdw_price?: number | string | null
  insurance_lia_accepted?: boolean | null; insurance_lia_price?: number | string | null
  insurance_tw_accepted?: boolean | null;  insurance_tw_price?: number | string | null
  insurance_at_accepted?: boolean | null;  insurance_at_price?: number | string | null
}

/**
 * Desglose vigente de una renta: el guardado (con sus conceptos tal como se eligieron),
 * recalculado con los días actuales (si se extendió la renta, los conceptos por día se ajustan
 * solos). Para reservas antiguas se arma con las columnas.
 * `adjustment` = diferencia entre el total guardado y el desglose (p. ej. cambio de vehículo o un
 * total editado a mano al extender), para que el contrato cuadre con el total de la reserva.
 */
export function resolveBreakdown(r: BreakdownSource) {
  const days = rentalDaysBetween(r.start_date, r.end_date)
  const saved = parseBreakdown(r.price_breakdown)
  const total = r.total_amount != null ? Number(r.total_amount) : null
  const n = (v: number | string | null | undefined) => v == null ? null : Number(v)
  const breakdown = saved
    ? computeBreakdown({ ...selectionFromBreakdown(saved), days }, catalogFromBreakdown(saved))
    : legacyBreakdown({
        days, daily_rate: n(r.daily_rate), total_amount: total,
        insurance: {
          cdw: { accepted: r.insurance_cdw_accepted ?? null, price: n(r.insurance_cdw_price) },
          lia: { accepted: r.insurance_lia_accepted ?? null, price: n(r.insurance_lia_price) },
          tw:  { accepted: r.insurance_tw_accepted  ?? null, price: n(r.insurance_tw_price) },
          at:  { accepted: r.insurance_at_accepted  ?? null, price: n(r.insurance_at_price) },
        },
      })
  const adjustment = total != null ? r2(total - breakdown.total) : 0
  return {
    days,
    breakdown,
    hasSavedBreakdown: !!saved,
    /** Total final de la renta (el guardado manda) */
    total: total ?? breakdown.total,
    adjustment: Math.abs(adjustment) >= 0.01 ? adjustment : 0,
  }
}
