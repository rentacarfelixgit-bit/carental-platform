'use client'

// src/app/dashboard/reservas/[id]/cambio-vehiculo/StartSwapForm.tsx
// Paso 1 del cambio: elegir el vehículo nuevo, el motivo y confirmar el precio.

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { listSwapCandidates, previewVehicleSwap, startVehicleSwap, type SwapCandidate } from './actions'
import { SWAP_REASONS, SWAP_REASON_KEYS, type SwapQuote, type SwapReason } from '@/lib/vehicleSwap'
import { fmtUSD } from '@/lib/currency'

const money = (n: number | null | undefined) =>
  fmtUSD(n)
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

export default function StartSwapForm({ reservationId, currentVehicle }: { reservationId: string; currentVehicle: string }) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<SwapCandidate[] | null>(null)
  const [filter, setFilter] = useState('')
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState<SwapReason>('customer_request')
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [total, setTotal] = useState('')
  const [totalTouched, setTotalTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => {
    let alive = true
    listSwapCandidates(reservationId).then(c => { if (alive) setCandidates(c) })
    return () => { alive = false }
  }, [reservationId])

  async function refreshQuote(vehicleId: string, r: SwapReason, keepTotal = totalTouched) {
    if (!vehicleId) { setQuote(null); return }
    const res = await previewVehicleSwap(reservationId, vehicleId, r)
    if (res.error) { setError(res.error); return }
    setQuote(res.quote ?? null)
    if (!keepTotal || SWAP_REASONS[r].keepPrice) {
      setTotal(res.quote?.suggestedTotal != null ? res.quote.suggestedTotal.toFixed(2) : '')
      setTotalTouched(false)
    }
  }

  const keepPrice = SWAP_REASONS[reason].keepPrice
  const totalNum  = total === '' ? null : Number(total)
  const adjusted  = !keepPrice && quote?.suggestedTotal != null && totalNum != null && Math.abs(totalNum - quote.suggestedTotal) >= 0.01
  const selected  = candidates?.find(c => c.id === toId)
  const list = (candidates ?? []).filter(c =>
    !filter.trim() || `${c.brand} ${c.model} ${c.plates} ${c.year}`.toLowerCase().includes(filter.trim().toLowerCase()))

  function submit() {
    setError('')
    start(async () => {
      const res = await startVehicleSwap(reservationId, { toVehicleId: toId, reason, finalTotal: keepPrice ? null : totalNum, notes })
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Motivo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">1. Motivo del cambio</h2>
        <div className="space-y-2">
          {SWAP_REASON_KEYS.map(k => (
            <label key={k} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer ${reason === k ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="reason" checked={reason === k} disabled={pending} className="mt-0.5 accent-blue-600"
                onChange={() => { setReason(k); refreshQuote(toId, k) }} />
              <span>
                <span className="block text-sm font-medium text-gray-900">{SWAP_REASONS[k].label}</span>
                <span className="block text-xs text-gray-500">{SWAP_REASONS[k].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Vehículo nuevo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">2. Vehículo nuevo</h2>
        <p className="text-xs text-gray-500 mb-2">Actual: <span className="font-medium text-gray-700">{currentVehicle}</span>. Solo se muestran vehículos libres hasta el regreso de la renta.</p>
        <input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar por marca, modelo o placa…" className={`${inputCls} mb-2`} />
        {candidates === null ? (
          <p className="text-sm text-gray-400">Buscando vehículos disponibles…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-orange-600">No hay vehículos disponibles para el resto del periodo.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {list.map(c => (
              <label key={c.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${toId === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <input type="radio" name="vehicle" checked={toId === c.id} disabled={pending} className="accent-blue-600"
                  onChange={() => { setToId(c.id); refreshQuote(c.id, reason) }} />
                <span className="flex-1 text-sm text-gray-800">{c.brand} {c.model} {c.year} <span className="font-mono text-xs text-gray-500">· {c.plates}</span></span>
                <span className="text-xs text-gray-500">{c.daily_rate != null ? `${money(Number(c.daily_rate))}/día` : 'sin tarifa'}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Precio */}
      {selected && quote && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">3. Precio</h2>
          {keepPrice ? (
            <p className="text-sm text-gray-700">
              Cambio <span className="font-medium">sin alterar precio</span>. El total se queda en <span className="font-semibold">{money(quote.oldTotal)}</span>.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm mb-3">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Con el vehículo actual</span>
                  <span>{quote.daysUsed} día{quote.daysUsed !== 1 ? 's' : ''} × {money(quote.oldPerDay)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Con el vehículo nuevo (desde hoy)</span>
                  <span>{quote.daysRemaining} día{quote.daysRemaining !== 1 ? 's' : ''} × {money(quote.newPerDay)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Total actual</span><span>{money(quote.oldTotal)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Total sugerido</span><span className="font-semibold">{money(quote.suggestedTotal)}</span>
                </div>
              </div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total a cobrar</label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">US$</span>
                <input type="text" inputMode="decimal" value={total} disabled={pending}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) { setTotal(v); setTotalTouched(true) } }}
                  className={inputCls} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                El promedio por día de lo cobrado se ajusta en la proporción de la tarifa del vehículo nuevo frente a la del actual.
              </p>
            </>
          )}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notas {adjusted ? <span className="text-red-500">* (ajustaste el total)</span> : <span className="text-gray-400 font-normal">(opcional)</span>}
            </label>
            <textarea rows={2} value={notes} maxLength={1000} disabled={pending} onChange={e => setNotes(e.target.value)}
              placeholder={reason === 'vehicle_issue' ? 'Ej. Testigo de motor encendido, ruido en frenos…' : 'Ej. El cliente pidió una camioneta más grande'}
              className={`${inputCls} resize-none`} />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={pending || !toId || !quote || (adjusted && !notes.trim())}
          className="text-sm px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
          {pending ? 'Iniciando…' : 'Iniciar cambio y registrar recepción'}
        </button>
      </div>
    </div>
  )
}
