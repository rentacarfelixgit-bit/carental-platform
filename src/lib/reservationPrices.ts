// src/lib/reservationPrices.ts
// Catálogo de seguros, extras e impuestos de la reserva y sus precios por defecto.
// Los precios por defecto los define el admin en Configuración y se guardan en
// tenants.settings.reservation_prices. En la reserva se precargan y se pueden modificar.

export type PriceKind = 'per_day' | 'flat' | 'pct'

export interface PriceItem {
  key: string
  label: string
  kind: PriceKind
  /** Valor si el admin aún no ha configurado uno */
  fallback: number
}

export const INSURANCE_ITEMS: PriceItem[] = [
  { key: 'cdw', label: 'Seg. de Colisión / CDW',          kind: 'per_day', fallback: 0 },
  { key: 'lia', label: 'Seg. Daños a 3eros / Liability',  kind: 'per_day', fallback: 0 },
  { key: 'tw',  label: 'Seg. Gomas y Cristales / TAW',    kind: 'per_day', fallback: 0 },
  { key: 'at',  label: 'Seg. Anti-Robo / Anti-Theft',     kind: 'per_day', fallback: 0 },
  { key: 'pkg', label: 'Paq. Básico de Seg. / Lia+TAW',   kind: 'per_day', fallback: 0 },
]

export const EXTRA_ITEMS: PriceItem[] = [
  { key: 'fuel',    label: 'Combustible / Prepay Gas Tank',     kind: 'flat', fallback: 0 },
  { key: 'carwash', label: 'Lavado del Vehículo / Car Wash',    kind: 'flat', fallback: 7 },
  { key: 'wifi',    label: 'Cajita de Internet / WiFi Hotspot', kind: 'flat', fallback: 7 },
  { key: 'carseat', label: 'Silla de Bebé / Car Seat',          kind: 'flat', fallback: 7 },
]

export const TAX_ITEMS: PriceItem[] = [
  { key: 'vlf',     label: 'Impuesto de Tránsito / VLF', kind: 'flat', fallback: 5 },
  { key: 'airport', label: 'Impuesto Aeroportuario',     kind: 'pct',  fallback: 10 },
  { key: 'itbis',   label: 'Impuesto / ITBIS',           kind: 'pct',  fallback: 18 },
]

export const ALL_PRICE_ITEMS: PriceItem[] = [...INSURANCE_ITEMS, ...EXTRA_ITEMS, ...TAX_ITEMS]

export type ReservationPrices = Record<string, number>

/** Combina lo guardado en tenants.settings con los valores de respaldo. */
export function getReservationPrices(settings: unknown): ReservationPrices {
  const saved = (settings && typeof settings === 'object'
    ? (settings as Record<string, unknown>).reservation_prices
    : null) as Record<string, unknown> | null

  const out: ReservationPrices = {}
  for (const item of ALL_PRICE_ITEMS) {
    const raw = saved?.[item.key]
    const v = raw === undefined || raw === null || raw === '' ? NaN : Number(raw)
    out[item.key] = Number.isFinite(v) && v >= 0 ? v : item.fallback
  }
  return out
}


// ─────────────────────────────────────────────────────────────────────────────
// Desglose de precios de una renta
// Se calcula igual en Nueva reserva, en "Preparar contrato" y en el servidor, y se guarda
// en reservations.price_breakdown para que el contrato muestre exactamente lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

export type BreakdownGroup = 'insurance' | 'extra' | 'tax' | 'other'

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
  /** Base de impuestos: renta + seguros + extras + otros */
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

/** Cálculo único de la renta. Impuestos %: sobre renta + seguros (igual que Nueva reserva). */
export function computeBreakdown(sel: PriceSelection): PriceBreakdown {
  const days = Math.max(0, Math.floor(sel.days))
  const dailyRate = Math.max(0, sel.dailyRate || 0)
  const price = (k: string) => Math.max(0, Number(sel.prices[k]) || 0)
  const rental = dailyRate * days
  const lines: BreakdownLine[] = []

  let insurance = 0
  for (const it of INSURANCE_ITEMS) {
    const checked = !!sel.checked[it.key]
    const amount = checked ? price(it.key) * days : 0
    insurance += amount
    lines.push({ key: it.key, group: 'insurance', label: it.label, kind: it.kind, price: price(it.key), checked, amount: r2(amount) })
  }
  let extras = 0
  for (const it of EXTRA_ITEMS) {
    const checked = !!sel.checked[it.key]
    const amount = checked ? price(it.key) : 0
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
  for (const it of TAX_ITEMS) {
    const checked = !!sel.checked[it.key]
    const amount = checked ? (it.kind === 'pct' ? taxBase * (price(it.key) / 100) : price(it.key)) : 0
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

/** Valida y normaliza un desglose que viene de la base de datos o de un formulario. */
export function parseBreakdown(raw: unknown): PriceBreakdown | null {
  let obj = raw
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) } catch { return null } }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Partial<PriceBreakdown>
  if (o.v !== 1 || !Array.isArray(o.lines)) return null
  // Se recalcula con el catálogo actual: nunca se confía en los importes que vienen de fuera
  const sel: PriceSelection = { days: Number(o.days) || 0, dailyRate: Number(o.daily_rate) || 0, checked: {}, prices: {} }
  for (const l of o.lines as Partial<BreakdownLine>[]) {
    if (!l || typeof l.key !== 'string') continue
    if (l.key === 'otros') {
      sel.otros = { label: String(l.label ?? 'Otros'), price: Number(l.price) || 0, checked: !!l.checked }
      continue
    }
    if (!ALL_PRICE_ITEMS.some(i => i.key === l.key)) continue
    sel.checked[l.key] = !!l.checked
    sel.prices[l.key] = Number(l.price) || 0
  }
  return computeBreakdown(sel)
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
 * Desglose vigente de una renta: el guardado, recalculado con los días actuales (si se extendió la
 * renta, los conceptos por día se ajustan solos). Para reservas antiguas se arma con las columnas.
 * `adjustment` = diferencia entre el total guardado y el desglose (p. ej. cambio de vehículo o un
 * total editado a mano al extender), para que el contrato cuadre con el total de la reserva.
 */
export function resolveBreakdown(r: BreakdownSource) {
  const days = rentalDaysBetween(r.start_date, r.end_date)
  const saved = parseBreakdown(r.price_breakdown)
  const total = r.total_amount != null ? Number(r.total_amount) : null
  const n = (v: number | string | null | undefined) => v == null ? null : Number(v)
  const breakdown = saved
    ? computeBreakdown({ ...selectionFromBreakdown(saved), days })
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
