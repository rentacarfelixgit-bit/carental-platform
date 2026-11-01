// src/lib/rentalClose.ts
// Cierre de una renta (recepción del vehículo). Compara el regreso real con lo pactado:
//  • Regreso tardío (más de 4 h) o renta sin fecha de retorno → se cobran los días reales.
//  • Regreso anticipado (1 día o más antes) → QUIEN CIERRA ELIGE (no hay opción por defecto):
//      - "full":    cobrar lo pactado completo
//      - "used":    cobrar solo los días usados
//      - "penalty": días usados + penalización (% del valor de los días no usados; 35% sugerido,
//                   editable en cada cierre, incluso 0%)
// Regla de días (igual que la cláusula del contrato): bloques de 24 h desde la salida; pasadas
// 4 h de un día se cobra el día completo.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isOpenEnded } from './openEnded'
import {
  parseBreakdown, computeBreakdown, selectionFromBreakdown, catalogFromBreakdown, rentalDaysBetween, insuranceColumns,
} from './reservationPrices'

export const LATE_GRACE_HOURS = 4
export const DEFAULT_EARLY_PENALTY_PCT = 35
export type EarlyReturnMode = 'full' | 'used' | 'penalty'
export const EARLY_RETURN_MODES: EarlyReturnMode[] = ['full', 'used', 'penalty']

const DAY = 86400000
const r2 = (n: number) => Math.round(n * 100) / 100

/** Días cobrables entre salida y regreso real, con 4 h de tolerancia */
export function rentalDaysWithGrace(start: string, end: string, graceHours = LATE_GRACE_HOURS): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!(ms > 0)) return 1
  const full = Math.floor(ms / DAY)
  const rest = ms - full * DAY
  return Math.max(1, full + (rest > graceHours * 3600000 ? 1 : 0))
}

export interface CloseRow {
  id: string
  start_date: string
  end_date: string
  total_amount: number | string | null
  daily_rate: number | string | null
  price_breakdown?: unknown
}

export interface ClosePreview {
  kind: 'none' | 'late' | 'open' | 'early'
  /** Hay algo que decidir/ajustar al cerrar */
  needsAdjust: boolean
  openEnded: boolean
  plannedEnd: string
  actualEnd: string
  plannedDays: number
  actualDays: number
  extraDays: number
  /** Días pactados que no se usaron (regreso anticipado) */
  unusedDays: number
  oldTotal: number | null
  /** Tardío / sin retorno: total por los días reales */
  suggestedTotal: number | null
  /** Anticipado: total por los días usados y valor de los días no usados */
  usedTotal: number | null
  unusedValue: number
}

/** Total para una cantidad de días: con el desglose (conceptos por día escalan, cargos únicos no)
 *  y conservando ajustes previos (cambio de vehículo, total editado a mano). */
export function totalForDays(r: CloseRow, days: number): number | null {
  const saved = parseBreakdown(r.price_breakdown)
  const oldTotal = r.total_amount != null ? Number(r.total_amount) : null
  if (saved) {
    const cat = catalogFromBreakdown(saved)
    const base = computeBreakdown({ ...selectionFromBreakdown(saved) }, cat)         // con los días guardados
    const next = computeBreakdown({ ...selectionFromBreakdown(saved), days }, cat)   // con los días nuevos
    const adjustment = oldTotal != null ? oldTotal - base.total : 0
    return r2(next.total + adjustment)
  }
  const oldDays = isOpenEnded(r.end_date) ? 1 : rentalDaysBetween(r.start_date, r.end_date) || 1
  if (oldTotal != null) return r2((oldTotal / oldDays) * days)
  return r.daily_rate != null ? r2(Number(r.daily_rate) * days) : null
}

export function previewClose(r: CloseRow, now: Date = new Date()): ClosePreview {
  const openEnded = isOpenEnded(r.end_date)
  const actualEnd = now.toISOString()
  const plannedDays = openEnded ? 1 : Math.max(1, rentalDaysBetween(r.start_date, r.end_date))
  const actualDays = rentalDaysWithGrace(r.start_date, actualEnd)
  const oldTotal = r.total_amount != null ? Number(r.total_amount) : null
  const late = !openEnded && now.getTime() > new Date(r.end_date).getTime() + LATE_GRACE_HOURS * 3600000 && actualDays > plannedDays
  const early = !openEnded && !late && actualDays < plannedDays
  const kind: ClosePreview['kind'] = openEnded ? 'open' : late ? 'late' : early ? 'early' : 'none'
  const usedTotal = early ? totalForDays(r, actualDays) : null
  return {
    kind, needsAdjust: kind !== 'none', openEnded,
    plannedEnd: r.end_date, actualEnd,
    plannedDays, actualDays,
    extraDays: late ? actualDays - plannedDays : 0,
    unusedDays: early ? plannedDays - actualDays : 0,
    oldTotal,
    suggestedTotal: kind === 'late' || kind === 'open' ? totalForDays(r, actualDays) : oldTotal,
    usedTotal,
    unusedValue: early && oldTotal != null && usedTotal != null ? r2(Math.max(0, oldTotal - usedTotal)) : 0,
  }
}

/** Total de un cierre anticipado según la opción elegida */
export function earlyReturnTotal(p: ClosePreview, mode: EarlyReturnMode, penaltyPct: number): number | null {
  if (mode === 'full') return p.oldTotal
  if (p.usedTotal == null) return p.oldTotal
  if (mode === 'used') return p.usedTotal
  const pct = Math.min(100, Math.max(0, Number(penaltyPct) || 0))
  return r2(p.usedTotal + p.unusedValue * pct / 100)
}

export interface CloseChoice {
  /** Total confirmado/editado por quien cierra */
  overrideTotal?: number | null
  /** Regreso anticipado: opción elegida (obligatoria) */
  earlyMode?: EarlyReturnMode | null
  earlyPenaltyPct?: number | null
}

/** Lee la decisión de cierre de un formulario */
export function readCloseChoice(fd: FormData): CloseChoice {
  const total = fd.get('close_total')?.toString().trim()
  const mode = fd.get('close_mode')?.toString() as EarlyReturnMode | undefined
  const pct = fd.get('close_penalty_pct')?.toString().trim()
  return {
    overrideTotal: total ? Number(total) : null,
    earlyMode: mode && EARLY_RETURN_MODES.includes(mode) ? mode : null,
    earlyPenaltyPct: pct ? Number(pct) : null,
  }
}

/** Mensaje si falta decidir el cobro de un regreso anticipado (null = todo bien) */
export function closeChoiceError(p: ClosePreview, choice: CloseChoice): string | null {
  if (p.kind !== 'early') return null
  if (!choice.earlyMode) return 'El vehículo regresó antes de lo pactado: elige cómo cobrar (lo pactado, solo los días usados o con penalización).'
  if (choice.earlyMode === 'penalty') {
    const pct = Number(choice.earlyPenaltyPct)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 'La penalización debe estar entre 0% y 100%.'
  }
  return null
}

/**
 * Aplica el ajuste de cierre: fecha de regreso real, total y desglose según el caso, y deja el
 * cambio en el historial (y en Auditoría). No hace nada si se regresó en la fecha pactada.
 */
export async function applyCloseAdjustment(
  supabase: SupabaseClient, tenantId: string, userId: string, reservationId: string,
  choice: CloseChoice = {},
): Promise<{ adjusted: boolean; error?: string }> {
  const { data: r } = await supabase.from('reservations')
    .select('id, start_date, end_date, total_amount, daily_rate, price_breakdown')
    .eq('id', reservationId).eq('tenant_id', tenantId).single()
  if (!r) return { adjusted: false, error: 'Renta no encontrada' }

  const p = previewClose(r as CloseRow)
  if (!p.needsAdjust) return { adjusted: false }
  const choiceErr = closeChoiceError(p, choice)
  if (choiceErr) return { adjusted: false, error: choiceErr }

  const pct = choice.earlyPenaltyPct ?? DEFAULT_EARLY_PENALTY_PCT
  const computed = p.kind === 'early' ? earlyReturnTotal(p, choice.earlyMode!, pct) : p.suggestedTotal
  const o = choice.overrideTotal
  const finalTotal = o != null && Number.isFinite(o) && o >= 0 ? r2(o) : computed

  const update: Record<string, unknown> = {
    end_date: p.actualEnd,
    total_amount: finalTotal,
    updated_at: new Date().toISOString(),
  }
  // Desglose con los días cobrados (si se cobra lo pactado completo, se queda como estaba)
  const saved = parseBreakdown(r.price_breakdown)
  if (saved && !(p.kind === 'early' && choice.earlyMode === 'full')) {
    const b = computeBreakdown({ ...selectionFromBreakdown(saved), days: p.actualDays }, catalogFromBreakdown(saved))
    update.price_breakdown = b
    Object.assign(update, insuranceColumns(b))
  }
  const { error } = await supabase.from('reservations').update(update).eq('id', reservationId).eq('tenant_id', tenantId)
  if (error) return { adjusted: false, error: error.message }

  const modeLabel: Record<EarlyReturnMode, string> = {
    full: 'se cobró lo pactado completo',
    used: 'se cobraron solo los días usados',
    penalty: `días usados + penalización del ${pct}%`,
  }
  await supabase.from('reservation_changes').insert({
    tenant_id: tenantId,
    reservation_id: reservationId,
    type: 'return_date',
    old_end_date: p.plannedEnd,
    new_end_date: p.actualEnd,
    old_total: p.oldTotal,
    suggested_total: computed,
    new_total: finalTotal,
    reason: p.kind === 'open' ? 'Cierre de renta sin fecha de retorno'
      : p.kind === 'late' ? `Regreso tardío: ${p.extraDays} día(s) extra`
      : `Regreso anticipado: ${p.unusedDays} día(s) sin usar; ${modeLabel[choice.earlyMode!]}`,
    details: {
      kind: p.kind === 'open' ? 'open_close' : p.kind === 'late' ? 'late_return' : 'early_return',
      old_days: p.plannedDays, new_days: p.actualDays,
      ...(p.kind === 'early' ? {
        early_mode: choice.earlyMode,
        penalty_pct: choice.earlyMode === 'penalty' ? pct : null,
        unused_value: p.unusedValue,
        used_total: p.usedTotal,
      } : {}),
      manually_adjusted: finalTotal !== computed,
    },
    created_by: userId,
  })
  return { adjusted: true }
}
