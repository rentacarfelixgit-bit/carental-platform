'use client'

import { useState, useTransition } from 'react'
import { saveTaxSettings } from './actions'

interface Props {
  settings: Record<string, unknown>
}

interface Tax {
  key: 'tax_itbis' | 'tax_airport' | 'tax_digital'
  label: string
  rate: string
  description: string
}

const TAXES: Tax[] = [
  { key: 'tax_itbis',   label: 'ITBIS',               rate: '18%', description: 'Impuesto sobre Transferencia de Bienes Industrializados y Servicios' },
  { key: 'tax_airport', label: 'Cargo aeroportuario',  rate: '10%', description: 'Aplica a servicios prestados en aeropuerto' },
  { key: 'tax_digital', label: 'Pagos digitales',      rate: '5%',  description: 'Aplica cuando el pago se realiza con tarjeta o transferencia' },
]

export default function TaxForm({ settings }: Props) {
  const [taxes, setTaxes] = useState({
    tax_itbis:   Boolean(settings.tax_itbis),
    tax_airport: Boolean(settings.tax_airport),
    tax_digital: Boolean(settings.tax_digital),
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function toggle(key: Tax['key']) {
    setTaxes(t => ({ ...t, [key]: !t[key] }))
    setSaved(false)
  }

  function handleSave() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await saveTaxSettings(taxes)
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  return (
    <div className="space-y-3">
      {TAXES.map(tax => (
        <div key={tax.key} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{tax.label}</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{tax.rate}</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{tax.description}</p>
          </div>
          {/* Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={taxes[tax.key]}
            onClick={() => toggle(tax.key)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              taxes[tax.key] ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
                taxes[tax.key] ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Guardando...' : 'Guardar impuestos'}
        </button>
        {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
