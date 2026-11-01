// src/lib/openEnded.ts
// Rentas SIN fecha de retorno (el cliente no sabe cuántos días usará el vehículo).
// Se guardan con una fecha de regreso "centinela" muy lejana: así el vehículo queda ocupado en
// todas las búsquedas de disponibilidad sin cambiar esas consultas. El total se muestra como
// estimado a la fecha y el real se calcula al cerrar la renta (inspección de entrada).

/** Fecha centinela de regreso para rentas sin fecha de retorno */
export const OPEN_END_ISO = '2099-12-31T23:59:00'
/** Igual, en formato de <input type="datetime-local"> */
export const OPEN_END_LOCAL = '2099-12-31T23:59'

export function isOpenEnded(endDate: string | null | undefined): boolean {
  if (!endDate) return false
  const y = new Date(endDate).getUTCFullYear()
  return Number.isFinite(y) && y >= 2099
}

/** Fin "efectivo" para cálculos: si no tiene retorno, ahora (mínimo 1 día después de la salida) */
export function effectiveEnd(startDate: string, endDate: string, now: Date = new Date()): string {
  if (!isOpenEnded(endDate)) return endDate
  const minEnd = new Date(new Date(startDate).getTime() + 86400000)
  return (now > minEnd ? now : minEnd).toISOString()
}

/** Texto para mostrar la fecha de regreso */
export function fmtReturn(endDate: string, fmt: (d: string) => string): string {
  return isOpenEnded(endDate) ? 'Sin fecha de retorno' : fmt(endDate)
}
