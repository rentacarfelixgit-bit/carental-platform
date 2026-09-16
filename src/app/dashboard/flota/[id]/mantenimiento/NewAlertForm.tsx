'use client'

// src/app/dashboard/flota/[id]/mantenimiento/NewAlertForm.tsx

import { useActionState } from 'react'
import { createMaintenanceAlert } from './actions'

const ALERT_TYPES: [string, string][] = [
  ['oil_change',           'Cambio de aceite'],
  ['insurance_renewal',    'Renovación de seguro'],
  ['tires',                'Llantas'],
  ['technical_inspection', 'Revisión técnica'],
  ['custom',               'Personalizada'],
]

export default function NewAlertForm({ vehicleId }: { vehicleId: string }) {
  const boundCreate = createMaintenanceAlert.bind(null, vehicleId)
  const [state, action, pending] = useActionState(boundCreate, {})

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-sm font-medium text-gray-700 mb-4">Nueva alerta</h2>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Alerta creada correctamente.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
            <select
              name="alert_type"
              disabled={pending}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
            >
              {ALERT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {state.fieldErrors?.alert_type && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.alert_type[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha límite</label>
            <input
              type="date"
              name="due_date"
              disabled={pending}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kilómetros límite</label>
            <input
              type="number"
              name="due_km"
              disabled={pending}
              placeholder="150000"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
            <input
              type="text"
              name="description"
              disabled={pending}
              placeholder="Detalle opcional..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {pending ? 'Guardando...' : 'Agregar alerta'}
          </button>
        </div>
      </form>
    </div>
  )
}
