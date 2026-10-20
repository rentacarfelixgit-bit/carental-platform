'use client'

// src/app/dashboard/reservas/[id]/ChangeReturnDateButton.tsx
// Extender o adelantar el regreso: muestra días y total sugerido (editable con motivo)
// y avisa si el vehículo ya está apartado en las nuevas fechas.

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { previewReturnDateChange, changeReturnDate, type ReturnDatePreview } from '../actions'
import { fmtUSD } from '@/lib/currency'

interface Props {
  reservationId: string
  /** ISO de Supabase, ej. 2026-10-20T10:00:00+00:00 */
  endDate: string
  kindLabel: string   // "reserva" | "contrato"
}

const money = (n: number | null | undefined) =>
  fmtUSD(n)

export default function ChangeReturnDateButton({ reservationId, endDate, kindLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const current = endDate.slice(0, 16)          // formato datetime-local
  const [newEnd, setNewEnd] = useState(current)
  const [preview, setPreview] = useState<ReturnDatePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [total, setTotal] = useState('')
  const [totalTouched, setTotalTouched] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  // Vista previa al cambiar la fecha (con un pequeño retardo; solo cuenta la última petición)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)
  function onDateChange(value: string) {
    setNewEnd(value)
    if (timer.current) clearTimeout(timer.current)
    if (!value || value === current) { setPreview(null); setLoadingPreview(false); return }
    setLoadingPreview(true)
    const myReq = ++reqId.current
    timer.current = setTimeout(async () => {
      const p = await previewReturnDateChange(reservationId, value)
      if (myReq !== reqId.current) return
      setPreview(p)
      setLoadingPreview(false)
      if (!totalTouched) setTotal(p.suggestedTotal != null ? p.suggestedTotal.toFixed(2) : '')
    }, 350)
  }

  const suggested = preview?.suggestedTotal ?? null
  const totalNum  = total === '' ? null : Number(total)
  const adjusted  = suggested != null && totalNum != null && Math.abs(totalNum - suggested) >= 0.01
  const needsReason = adjusted && !reason.trim()
  const canSave = !!preview && !preview.error && !preview.conflict && !loadingPreview && !needsReason && !saving
  const deltaDays = preview?.newDays != null && preview?.oldDays != null ? preview.newDays - preview.oldDays : 0

  function close() {
    if (timer.current) clearTimeout(timer.current)
    reqId.current++
    setOpen(false); setNewEnd(current); setPreview(null); setTotal(''); setTotalTouched(false); setReason(''); setError('')
  }

  function save() {
    setError('')
    startSaving(async () => {
      const res = await changeReturnDate(reservationId, newEnd, totalNum, reason)
      if (res.error) { setError(res.error); return }
      router.refresh()
      close()
    })
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3.75h.008v.008H12v-.008z" />
        </svg>
        Cambiar fecha de regreso
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="crd-title">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 id="crd-title" className="text-base font-semibold text-gray-900">Cambiar fecha de regreso</h2>
              <p className="text-xs text-gray-500 mt-0.5">Extiende o adelanta el regreso de esta {kindLabel}. El total se recalcula y lo puedes ajustar.</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="block text-xs font-medium text-gray-600 mb-1">Regreso actual</p>
                  <p className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                    {new Date(current).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div>
                  <label htmlFor="crd-new" className="block text-xs font-medium text-gray-600 mb-1">Nuevo regreso *</label>
                  <input id="crd-new" type="datetime-local" value={newEnd} onChange={e => onDateChange(e.target.value)} disabled={saving} className={inputCls} />
                </div>
              </div>

              {loadingPreview && <p className="text-xs text-gray-400">Calculando…</p>}

              {preview?.error && <p className="text-sm text-red-600">{preview.error}</p>}
              {preview?.conflict && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{preview.conflict}</div>
              )}

              {preview && !preview.error && !loadingPreview && (
                <>
                  <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-gray-500">Días</span>
                      <span className="font-medium text-gray-900">
                        {preview.oldDays} → {preview.newDays}
                        <span className={`ml-1.5 text-xs ${deltaDays > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          ({deltaDays > 0 ? '+' : ''}{deltaDays} día{Math.abs(deltaDays) !== 1 ? 's' : ''})
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-gray-500">Total actual</span>
                      <span className="text-gray-900">{money(preview.oldTotal)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-gray-500">
                        Total sugerido
                        {preview.perDay != null && <span className="block text-[11px] text-gray-400">{money(preview.perDay)} promedio por día</span>}
                      </span>
                      <span className="font-semibold text-gray-900">{money(suggested)}</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="crd-total" className="block text-xs font-medium text-gray-600 mb-1">Total a cobrar</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">US$</span>
                      <input
                        id="crd-total" type="text" inputMode="decimal" value={total} disabled={saving}
                        onChange={e => {
                          const v = e.target.value
                          if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) { setTotal(v); setTotalTouched(true) }
                        }}
                        className={inputCls}
                      />
                    </div>
                    {adjusted && (
                      <p className="mt-1 text-xs text-amber-700">
                        Ajustado a mano ({totalNum! < suggested! ? 'descuento' : 'cargo extra'} de {money(Math.abs(totalNum! - suggested!))}).
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="crd-reason" className="block text-xs font-medium text-gray-600 mb-1">
                      Motivo {adjusted ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(opcional)</span>}
                    </label>
                    <textarea
                      id="crd-reason" rows={2} value={reason} maxLength={500} disabled={saving}
                      onChange={e => setReason(e.target.value)}
                      placeholder={adjusted ? 'Ej. Descuento por cliente frecuente' : 'Ej. El cliente pidió dos días más'}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
              <button type="button" onClick={close} disabled={saving}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={!canSave}
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
