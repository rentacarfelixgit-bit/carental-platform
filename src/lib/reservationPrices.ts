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

