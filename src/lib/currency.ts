// src/lib/currency.ts
// Moneda del sistema. Todos los precios y montos se capturan y se muestran en US$ (moneda base).
// Cada tenant configura su moneda local y la tasa (Configuración → Moneda). La moneda local solo
// aparece al final del cobro: tasa de cambio y total equivalente. La tasa se congela en cada renta
// (reservations.exchange_rate) al crearla y se puede ajustar en esa renta.

export const BASE_CURRENCY = { code: 'USD', symbol: 'US$', name: 'Dólares' } as const

export interface CurrencySettings {
  localCode: string     // ISO, p. ej. DOP
  localSymbol: string   // p. ej. RD$
  localName: string     // p. ej. Pesos dominicanos
  /** 1 US$ = rate moneda local. 0 = sin configurar */
  rate: number
}

export const DEFAULT_CURRENCY: CurrencySettings = {
  localCode: 'DOP', localSymbol: 'RD$', localName: 'Pesos dominicanos', rate: 0,
}

/** Lee tenants.settings.currency con valores de respaldo. */
export function getCurrencySettings(settings: unknown): CurrencySettings {
  const c = (settings && typeof settings === 'object'
    ? (settings as Record<string, unknown>).currency
    : null) as Record<string, unknown> | null
  const rate = Number(c?.exchange_rate)
  return {
    localCode:   typeof c?.local_code === 'string' && c.local_code ? c.local_code : DEFAULT_CURRENCY.localCode,
    localSymbol: typeof c?.local_symbol === 'string' && c.local_symbol ? c.local_symbol : DEFAULT_CURRENCY.localSymbol,
    localName:   typeof c?.local_name === 'string' && c.local_name ? c.local_name : DEFAULT_CURRENCY.localName,
    rate:        Number.isFinite(rate) && rate > 0 ? rate : 0,
  }
}

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

/** US$1,234.50 */
export function fmtUSD(n: number | string | null | undefined, empty = '—'): string {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return empty
  const v = Number(n)
  return `${v < 0 ? '-' : ''}${BASE_CURRENCY.symbol}${nf.format(Math.abs(v))}`
}

/** RD$1,234.50 (o el símbolo local del tenant) */
export function fmtLocal(n: number | null | undefined, symbol: string, empty = '—'): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return empty
  return `${n < 0 ? '-' : ''}${symbol}${nf.format(Math.abs(n))}`
}

/** "1 US$ = 60.50 RD$" */
export function fmtRate(rate: number, symbol: string): string {
  return rate > 0 ? `1 ${BASE_CURRENCY.symbol} = ${rf.format(rate)} ${symbol}` : 'Sin tasa'
}

/** Total en moneda local (null si no hay tasa) */
export function toLocal(usd: number, rate: number): number | null {
  return rate > 0 ? Math.round(usd * rate * 100) / 100 : null
}

/** Moneda en que se capturó un abono: 'USD' o el código local del tenant */
export type PaymentCurrency = string

/** Abono convertido a US$ (si se pagó en moneda local se divide entre la tasa de la renta) */
export function paymentToUSD(amount: number, currency: PaymentCurrency | null | undefined, rate: number): number {
  if (!amount) return 0
  if (!currency || currency === BASE_CURRENCY.code) return amount
  return rate > 0 ? Math.round((amount / rate) * 100) / 100 : 0
}

/** Formatea un abono en la moneda en que se capturó */
export function fmtPayment(amount: number, currency: PaymentCurrency | null | undefined, cur: CurrencySettings): string {
  return !currency || currency === BASE_CURRENCY.code ? fmtUSD(amount) : fmtLocal(amount, cur.localSymbol)
}

/** Tasa efectiva de una renta: la guardada en la renta; si no tiene, la de Configuración */
export function rentalRate(saved: number | string | null | undefined, cur: CurrencySettings): number {
  const n = Number(saved)
  return Number.isFinite(n) && n > 0 ? n : cur.rate
}
