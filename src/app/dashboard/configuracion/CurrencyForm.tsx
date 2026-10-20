'use client'

// src/app/dashboard/configuracion/CurrencyForm.tsx
// Moneda local y tasa de cambio del negocio. Los precios del sistema siempre van en US$;
// la moneda local solo aparece al final del cobro (tasa y total equivalente).

import { useState, useTransition } from 'react'
import { saveCurrencySettings } from './actions'
import { fmtUSD, fmtLocal, fmtRate, type CurrencySettings } from '@/lib/currency'

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'

export default function CurrencyForm({ currency, canEdit }: { currency: CurrencySettings; canEdit: boolean }) {
  const [code,   setCode]   = useState(currency.localCode)
  const [symbol, setSymbol] = useState(currency.localSymbol)
  const [name,   setName]   = useState(currency.localName)
  const [rate,   setRate]   = useState(currency.rate ? String(currency.rate) : '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const rateNum = Number(rate) || 0
  const dirty = () => setSaved(false)

  function handleSave() {
    setError(''); setSaved(false)
    startTransition(async () => {
      const res = await saveCurrencySettings({ local_code: code, local_symbol: symbol, local_name: name, exchange_rate: rateNum })
      if (res?.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="flex items-start gap-3 text-sm">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">US$</span>
          <p className="text-gray-600">
            Todos los precios, tarifas, cargos y totales se manejan en <b>dólares (US$)</b>. La moneda local solo se usa
            para mostrar el total equivalente y para registrar abonos pagados en esa moneda.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Código de la moneda local</label>
            <input value={code} maxLength={3} disabled={!canEdit || pending} placeholder="DOP"
              onChange={e => { setCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase()); dirty() }}
              className={`${inputCls} uppercase`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Símbolo</label>
            <input value={symbol} maxLength={6} disabled={!canEdit || pending} placeholder="RD$"
              onChange={e => { setSymbol(e.target.value); dirty() }} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input value={name} maxLength={40} disabled={!canEdit || pending} placeholder="Pesos dominicanos"
              onChange={e => { setName(e.target.value); dirty() }} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tasa de cambio</label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 whitespace-nowrap">1 US$ =</span>
            <input type="text" inputMode="decimal" value={rate} disabled={!canEdit || pending} placeholder="0.00"
              onChange={e => { const v = e.target.value; if (v === '' || /^\d{0,7}(\.\d{0,4})?$/.test(v)) { setRate(v); dirty() } }}
              className="w-32 px-3 py-2 text-sm text-right border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            <span className="text-gray-600">{symbol || code}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Se precarga en cada reserva o contrato nuevo y queda guardada en esa renta: si cambias la tasa aquí,
            las rentas ya creadas conservan la suya (se puede ajustar dentro de cada renta).
          </p>
        </div>

        {rateNum > 0 && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
            Ejemplo: un total de <b>{fmtUSD(100)}</b> se mostrará también como <b>{fmtLocal(100 * rateNum, symbol || code)}</b> ({fmtRate(rateNum, symbol || code)}).
          </div>
        )}
      </div>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleSave} disabled={pending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {pending ? 'Guardando...' : 'Guardar moneda'}
          </button>
          {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Solo un administrador puede modificar la moneda y la tasa.</p>
      )}
    </div>
  )
}
