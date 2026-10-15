'use client'

// src/app/dashboard/configuracion/ReservationPricesForm.tsx
// Precios por defecto de seguros, extras e impuestos. Se precargan en Nueva reserva,
// donde se pueden ajustar para cada reserva.

import { useState, useTransition } from 'react'
import { saveReservationPrices } from './actions'
import {
  INSURANCE_ITEMS, EXTRA_ITEMS, TAX_ITEMS,
  type PriceItem, type ReservationPrices,
} from '@/lib/reservationPrices'

interface Props {
  prices: ReservationPrices
  canEdit: boolean
}

const GROUPS: { title: string; hint: string; items: PriceItem[] }[] = [
  { title: 'Seguros',   hint: 'Precio por día',                         items: INSURANCE_ITEMS },
  { title: 'Extras',    hint: 'Cargo único por reserva',                items: EXTRA_ITEMS },
  { title: 'Impuestos', hint: 'Monto fijo o porcentaje sobre renta + seguros', items: TAX_ITEMS },
]

export default function ReservationPricesForm({ prices, canEdit }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, String(v)]))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function change(key: string, raw: string) {
    // Solo números con hasta 2 decimales
    if (raw !== '' && !/^\d*\.?\d{0,2}$/.test(raw)) return
    setValues(v => ({ ...v, [key]: raw }))
    setSaved(false)
  }

  function handleSave() {
    setError(''); setSaved(false)
    const payload = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === '' ? 0 : Number(v)])
    )
    startTransition(async () => {
      const res = await saveReservationPrices(payload)
      if (res?.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(g => (
        <div key={g.title} className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between">
            <h3 className="text-sm font-medium text-gray-900">{g.title}</h3>
            <span className="text-xs text-gray-400">{g.hint}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {g.items.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <label htmlFor={`price_${item.key}`} className="text-sm text-gray-700 flex-1">{item.label}</label>
                <div className="flex items-center gap-1.5">
                  {item.kind !== 'pct' && <span className="text-xs text-gray-400">RD$</span>}
                  <input
                    id={`price_${item.key}`}
                    type="text"
                    inputMode="decimal"
                    value={values[item.key] ?? ''}
                    onChange={e => change(item.key, e.target.value)}
                    disabled={!canEdit || pending}
                    placeholder="0.00"
                    className="w-24 px-2 py-1.5 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  <span className="text-xs text-gray-400 w-10">
                    {item.kind === 'pct' ? '%' : item.kind === 'per_day' ? '/ día' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {canEdit ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Guardando...' : 'Guardar precios'}
          </button>
          {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Solo un administrador puede modificar estos precios.</p>
      )}
    </div>
  )
}

