'use client'

// src/app/dashboard/reservas/[id]/InspectionGateModal.tsx
// Modal que aparece al marcar "en curso" o "completada" cuando no hay inspección registrada.
// Requiere odómetro + combustible siempre.
// Permite elegir entre tomar fotos o continuar sin fotos nuevas.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createQuickInspection } from '../actions'

const FUEL_OPTIONS = [
  { value: 'full',           label: 'Lleno (100%)' },
  { value: 'three_quarters', label: '3/4 (75%)' },
  { value: 'half',           label: 'Mitad (50%)' },
  { value: 'quarter',        label: '1/4 (25%)' },
  { value: 'empty',          label: 'Vacío (0%)' },
]

interface Props {
  reservationId: string
  type: 'checkout' | 'checkin'
  onClose: () => void
}

export default function InspectionGateModal({ reservationId, type, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [odometer, setOdometer] = useState('')
  const [fuelLevel, setFuelLevel] = useState('')
  const [error, setError] = useState('')

  const isCheckout = type === 'checkout'

  function handleGoInspect() {
    const params = new URLSearchParams()
    if (odometer) params.set('odometer', odometer)
    if (fuelLevel) params.set('fuel', fuelLevel)
    const qs = params.toString()
    router.push(`/dashboard/reservas/${reservationId}/inspecciones/${type}${qs ? `?${qs}` : ''}`)
    onClose()
  }

  function handleContinue() {
    setError('')
    const km = parseInt(odometer, 10)
    if (!odometer || isNaN(km) || km <= 0) {
      setError('El odómetro es requerido y debe ser un número positivo.')
      return
    }
    if (!fuelLevel) {
      setError('El nivel de combustible es requerido.')
      return
    }
    startTransition(async () => {
      const result = await createQuickInspection(reservationId, type, km, fuelLevel)
      if (result?.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !isPending) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Ícono + título */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {isCheckout
                  ? 'No se han tomado fotos de salida'
                  : 'No se han tomado fotos de regreso'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {isCheckout
                  ? 'Las fotografías del estado del vehículo al salir no han sido capturadas. Puedes tomarlas ahora o continuar sin nuevas fotografías.'
                  : '¿El vehículo regresó en las mismas condiciones? Puedes tomar las fotos de regreso ahora o registrar la devolución con las fotografías existentes.'}
              </p>
            </div>
          </div>

          {/* Campos obligatorios siempre */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              Lecturas obligatorias del vehículo
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Odómetro (km) *
              </label>
              <input
                type="number"
                value={odometer}
                onChange={e => setOdometer(e.target.value)}
                placeholder="Ej. 45 000"
                min={1}
                max={999999}
                step={1}
                disabled={isPending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel de combustible *
              </label>
              <select
                value={fuelLevel}
                onChange={e => setFuelLevel(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:opacity-50"
              >
                <option value="">Selecciona el nivel...</option>
                {FUEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="px-6 py-4 flex flex-col gap-2">
          {/* Opción principal: ir a tomar fotos */}
          <button
            type="button"
            onClick={handleGoInspect}
            disabled={isPending}
            className="w-full py-2.5 text-sm font-semibold text-blue-700 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {isCheckout
              ? 'Tomar fotos de salida'
              : 'Tomar fotos de regreso'}
          </button>

          {/* Opción secundaria: continuar sin fotos */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </>
            ) : (
              isCheckout
                ? 'Continuar sin nuevas fotos de salida'
                : 'Sí, el vehículo regresó en las mismas condiciones'
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
