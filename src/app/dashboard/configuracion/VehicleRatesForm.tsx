'use client'

import { useState, useTransition } from 'react'
import { saveVehicleRate } from './actions'

interface Vehicle {
  id: string
  brand: string
  model: string
  year: number
  plates: string
  daily_rate: number | null
}

export default function VehicleRatesForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(vehicles.map(v => [v.id, v.daily_rate?.toString() ?? '']))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  function handleSave(vehicleId: string) {
    const val = parseFloat(rates[vehicleId] ?? '')
    if (isNaN(val) || val < 0) {
      setErrors(e => ({ ...e, [vehicleId]: 'Ingresa un valor válido' }))
      return
    }
    setErrors(e => { const n = { ...e }; delete n[vehicleId]; return n })
    setSaving(vehicleId)
    setSaved(null)
    startTransition(async () => {
      const result = await saveVehicleRate(vehicleId, val)
      setSaving(null)
      if (result?.error) setErrors(e => ({ ...e, [vehicleId]: result.error! }))
      else setSaved(vehicleId)
    })
  }

  if (vehicles.length === 0) {
    return <p className="text-sm text-gray-400">No hay vehículos activos.</p>
  }

  return (
    <div className="space-y-3">
      {vehicles.map(v => (
        <div key={v.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{v.brand} {v.model} <span className="text-gray-400 font-normal">{v.year}</span></p>
            <p className="text-xs font-mono text-gray-400">{v.plates}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">USD $</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rates[v.id]}
              onChange={e => {
                setRates(r => ({ ...r, [v.id]: e.target.value }))
                setSaved(null)
              }}
              placeholder="0.00"
              className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">/ día</span>
            <button
              onClick={() => handleSave(v.id)}
              disabled={saving === v.id}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving === v.id ? '...' : 'Guardar'}
            </button>
            {saved === v.id && <span className="text-xs text-green-600">✓</span>}
          </div>
          {errors[v.id] && (
            <p className="text-xs text-red-500 w-full mt-1">{errors[v.id]}</p>
          )}
        </div>
      ))}
    </div>
  )
}
