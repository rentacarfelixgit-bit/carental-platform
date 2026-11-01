'use client'

// Aviso al recibir el vehículo (cierre de la renta):
//  • Regreso tardío (más de 4 h) o sin fecha de retorno: días reales y total sugerido, editable.
//  • Regreso anticipado: quien cierra ELIGE cómo cobrar — no hay opción marcada por defecto:
//      lo pactado completo · solo los días usados · días usados + penalización (% editable).

import { useState } from 'react'
import { fmtUSD } from '@/lib/currency'
import {
  earlyReturnTotal, DEFAULT_EARLY_PENALTY_PCT,
  type ClosePreview, type EarlyReturnMode,
} from '@/lib/rentalClose'

const fmt = (d: string) => new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

export default function CloseAdjustment({ preview: p, disabled }: { preview: ClosePreview; disabled?: boolean }) {
  const early = p.kind === 'early'
  const [mode, setMode] = useState<EarlyReturnMode | null>(null)
  const [pct, setPct] = useState(String(DEFAULT_EARLY_PENALTY_PCT))
  const pctNum = Math.min(100, Math.max(0, parseFloat(pct) || 0))
  const computed = early ? (mode ? earlyReturnTotal(p, mode, pctNum) : null) : p.suggestedTotal

  // Total final: sigue al cálculo mientras no se edite a mano
  const [manual, setManual] = useState<string | null>(null)
  const total = manual ?? (computed != null ? computed.toFixed(2) : '')
  const edited = manual != null && computed != null && Math.abs((parseFloat(manual) || 0) - computed) >= 0.01

  const options: { id: EarlyReturnMode; title: string; desc: string; amount: number | null }[] = [
    { id: 'full', title: 'Cobrar lo pactado completo', desc: `${p.plannedDays} día(s), aunque usó ${p.actualDays}.`, amount: p.oldTotal },
    { id: 'used', title: 'Cobrar solo los días usados', desc: `${p.actualDays} día(s), sin penalización.`, amount: p.usedTotal },
    { id: 'penalty', title: 'Días usados + penalización', desc: `${p.actualDays} día(s) + un % del valor de los ${p.unusedDays} día(s) no usados (${fmtUSD(p.unusedValue)}).`, amount: earlyReturnTotal(p, 'penalty', pctNum) },
  ]

  const title = p.kind === 'open' ? 'Cierre de renta sin fecha de retorno'
    : p.kind === 'late' ? `Regreso tardío: ${p.extraDays} día${p.extraDays !== 1 ? 's' : ''} extra`
    : `Regreso anticipado: ${p.unusedDays} día${p.unusedDays !== 1 ? 's' : ''} sin usar`

  return (
    <div className={`${early ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'} border rounded-xl p-5 space-y-4`}>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-600 mt-0.5">
          {p.kind === 'open' ? 'La renta se cobra por los días reales hasta ahora.'
            : <>Regreso pactado: {fmt(p.plannedEnd)}. {early ? 'Elige cómo cobrar este cierre.' : 'Pasadas 4 h de tolerancia se cobra un día más.'}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><p className="text-xs text-gray-500">Días pactados</p><p className="font-medium text-gray-900">{p.openEnded ? 'Abierto' : p.plannedDays}</p></div>
        <div><p className="text-xs text-gray-500">Días usados</p><p className="font-medium text-gray-900">{p.actualDays}</p></div>
        <div><p className="text-xs text-gray-500">Total pactado</p><p className="font-medium text-gray-900">{fmtUSD(p.oldTotal)}</p></div>
        {!early && <div><p className="text-xs text-gray-500">Total sugerido</p><p className="font-medium text-gray-900">{fmtUSD(p.suggestedTotal)}</p></div>}
      </div>

      {/* Regreso anticipado: elegir (obligatorio, sin opción por defecto) */}
      {early && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-gray-700 mb-1">¿Cómo se cobra? <span className="text-red-500">*</span></legend>
          {options.map(o => (
            <label key={o.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer bg-white ${mode === o.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="close_mode" value={o.id} required checked={mode === o.id} disabled={disabled}
                onChange={() => { setMode(o.id); setManual(null) }} className="mt-0.5 accent-blue-600" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900">{o.title}</span>
                <span className="block text-xs text-gray-500">{o.desc}</span>
                {o.id === 'penalty' && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-700" onClick={e => e.preventDefault()}>
                    Penalización
                    <input type="text" inputMode="decimal" value={pct} disabled={disabled}
                      onFocus={() => { setMode('penalty'); setManual(null) }}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d{0,3}(\.\d{0,2})?$/.test(v)) { setPct(v); setManual(null) } }}
                      className="w-16 px-2 py-1 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    % de los días no usados <span className="text-gray-400">(0% = sin cobrarla)</span>
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{fmtUSD(o.amount)}</span>
            </label>
          ))}
          <input type="hidden" name="close_penalty_pct" value={mode === 'penalty' ? String(pctNum) : ''} />
        </fieldset>
      )}

      {(!early || mode) && (
        <label className="block">
          <span className="block text-xs font-medium text-gray-700 mb-1">Total a cobrar (US$)</span>
          <input type="text" name="close_total" inputMode="decimal" value={total} disabled={disabled}
            onChange={e => { const v = e.target.value; if (v === '' || /^\d{0,7}(\.\d{0,2})?$/.test(v)) setManual(v) }}
            className="w-40 px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {edited && <span className="ml-2 text-xs text-amber-800">Ajustado a mano (queda en la Auditoría)</span>}
        </label>
      )}
      {early && !mode && <p className="text-xs text-blue-800">Elige una opción para poder registrar la recepción.</p>}

      <p className="text-[11px] text-gray-600">
        Al guardar, la fecha de regreso se actualiza a la real y el contrato cerrado muestra el total elegido. La decisión queda en el historial de la renta y en la Auditoría.
      </p>
    </div>
  )
}
