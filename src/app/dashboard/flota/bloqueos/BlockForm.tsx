'use client'

import { useRef, useState, useTransition } from 'react'
import { createBlock } from './actions'

interface Vehicle {
  id: string
  brand: string
  model: string
  year: number
  plates: string
}

const REASONS = [
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'cleaning',    label: 'Limpieza' },
  { value: 'repair',      label: 'Reparación' },
  { value: 'custom',      label: 'Otro' },
]

export default function BlockForm({ vehicles }: { vehicles: Vehicle[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const fd = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createBlock(fd)
      if (result?.error) setError(result.error)
      else {
        setSuccess(true)
        formRef.current?.reset()
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehículo *</label>
          <select
            name="vehicle_id"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona un vehículo</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} {v.year} — {v.plates}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Motivo *</label>
          <select
            name="reason"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona motivo</option>
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde *</label>
          <input
            type="datetime-local"
            name="start_date"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta *</label>
          <input
            type="datetime-local"
            name="end_date"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Descripción adicional del bloqueo..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Guardando...' : 'Bloquear vehículo'}
        </button>
        {success && <span className="text-sm text-green-600">Bloqueo registrado</span>}
        {error   && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  )
}
