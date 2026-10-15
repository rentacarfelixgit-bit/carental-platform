// src/lib/calendarReturn.ts
// "Volver al calendario": cuando una renta se abre desde el calendario, el enlace lleva
// ?from=calendario&mes=YYYY-MM&dia=D para que el detalle regrese al mismo mes y día.

export interface CalendarReturn { mes: string; dia: number | null; vista: 'mes' | 'dia' }

/** Lee y valida los parámetros (solo acepta valores con formato correcto) */
export function parseCalendarReturn(sp: { from?: string; mes?: string; dia?: string; vista?: string }): CalendarReturn | null {
  if (sp.from !== 'calendario') return null
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : null
  if (!mes) return null
  const d = Number(sp.dia)
  const dia = Number.isInteger(d) && d >= 1 && d <= 31 ? d : null
  return { mes, dia, vista: sp.vista === 'dia' && dia ? 'dia' : 'mes' }
}

/** Query string para abrir una renta desde el calendario */
export function calendarFromQuery(mes: string, dia?: number | null, vista: 'mes' | 'dia' = 'mes') {
  return `from=calendario&mes=${mes}${dia ? `&dia=${dia}` : ''}${vista === 'dia' && dia ? '&vista=dia' : ''}`
}

/** URL para regresar al calendario en el mes y día de origen */
export function calendarHref(r: CalendarReturn) {
  if (r.vista === 'dia' && r.dia) return dayViewHref(`${r.mes}-${String(r.dia).padStart(2, '0')}`)
  return `/dashboard/reservas/calendario?mes=${r.mes}${r.dia ? `&dia=${r.dia}` : ''}`
}

/** Vista de un día con todas sus rentas y eventos (fecha YYYY-MM-DD) */
export function dayViewHref(fecha: string) {
  return `/dashboard/reservas/calendario/dia?fecha=${fecha}`
}
