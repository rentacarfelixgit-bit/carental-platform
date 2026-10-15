// src/lib/vehicleSwap.ts
// Cálculo y nombres del cambio de vehículo. Lo usan las acciones (servidor) y la pantalla.

export type SwapReason = 'customer_request' | 'vehicle_issue' | 'unavailable'

export const SWAP_REASONS: Record<SwapReason, { label: string; hint: string; keepPrice: boolean }> = {
  customer_request: {
    label: 'A solicitud del cliente',
    hint: 'El precio se respeta hasta el día del cambio; desde ese día se cobra con la tarifa del nuevo vehículo.',
    keepPrice: false,
  },
  vehicle_issue: {
    label: 'Falla o problema del vehículo',
    hint: 'Sin alterar el precio de la renta.',
    keepPrice: true,
  },
  unavailable: {
    label: 'El vehículo reservado no está disponible',
    hint: 'Sin alterar el precio de la renta.',
    keepPrice: true,
  },
}

export const SWAP_REASON_KEYS = Object.keys(SWAP_REASONS) as SwapReason[]

const MS_DAY = 1000 * 60 * 60 * 24
const round2 = (n: number) => Math.round(n * 100) / 100

export interface SwapQuote {
  totalDays: number
  daysUsed: number         // días con el vehículo original (antes del día del cambio)
  daysRemaining: number    // días con el vehículo nuevo (desde el día del cambio)
  oldTotal: number | null
  oldPerDay: number | null // promedio por día de lo cobrado
  newPerDay: number | null // promedio por día ajustado a la tarifa del nuevo vehículo
  suggestedTotal: number | null
}

/**
 * Precio por tramos: lo cobrado por día se respeta hasta el día del cambio y, desde ese día,
 * se ajusta en la proporción de la tarifa del nuevo vehículo vs. la del original.
 * Si el cambio no altera precio, el total sugerido es el mismo.
 */
export function quoteSwap(input: {
  startDate: string
  endDate: string
  swapAt: string
  total: number | null
  fromRate: number | null
  toRate: number | null
  keepPrice: boolean
}): SwapQuote {
  const start = new Date(input.startDate).getTime()
  const end   = new Date(input.endDate).getTime()
  const at    = new Date(input.swapAt).getTime()
  const totalDays = Math.max(1, Math.ceil((end - start) / MS_DAY))
  const daysUsed  = Math.min(totalDays, Math.max(0, Math.floor((at - start) / MS_DAY)))
  const daysRemaining = totalDays - daysUsed

  const oldTotal  = input.total != null ? Number(input.total) : null
  const oldPerDay = oldTotal != null ? oldTotal / totalDays : input.fromRate
  const ratio     = input.fromRate && input.toRate ? input.toRate / input.fromRate : 1
  const newPerDay = oldPerDay != null ? oldPerDay * ratio : input.toRate

  let suggested: number | null
  if (input.keepPrice) suggested = oldTotal
  else if (oldPerDay != null && newPerDay != null) suggested = round2(oldPerDay * daysUsed + newPerDay * daysRemaining)
  else suggested = oldTotal

  return {
    totalDays, daysUsed, daysRemaining, oldTotal,
    oldPerDay: oldPerDay != null ? round2(oldPerDay) : null,
    newPerDay: newPerDay != null ? round2(newPerDay) : null,
    suggestedTotal: suggested,
  }
}
