'use client'

// src/app/dashboard/reservas/[id]/inspecciones/[type]/InspeccionForm.tsx

import { useActionState, useState } from 'react'
import { createInspection } from '../actions'
import DamageMap, { type DamagePoint } from './DamageMap'
import PhotoUploader from './PhotoUploader'
import Link from 'next/link'
import type { BaselinePhoto } from './page'

const FUEL_LABELS: Record<string, string> = {
  full:            'Lleno (100%)',
  three_quarters:  '3/4 (75%)',
  half:            'Mitad (50%)',
  quarter:         '1/4 (25%)',
  empty:           'Vacío',
}

const ANGLE_LABELS: Record<string, string> = {
  front:    'Frente',
  rear:     'Trasera',
  left:     'Lateral izq.',
  right:    'Lateral der.',
  interior: 'Interior',
  other:    'Otro',
}

interface Props {
  reservationId: string
  type: 'checkout' | 'checkin'
  vehicleLabel: string
  tenantId: string
  inspectionId: string          // UUID pre-generado para subir fotos antes del submit
  baselinePhotos: BaselinePhoto[]
}

export default function InspeccionForm({ reservationId, type, vehicleLabel, tenantId, inspectionId, baselinePhotos }: Props) {
  const boundCreate = createInspection.bind(null, reservationId, inspectionId)
  const [state, action, pending] = useActionState(boundCreate, {})
  const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([])
  const [photoPaths,   setPhotoPaths]   = useState<string[]>([])

  // null = sin respuesta, true = mismo estado, false = hay cambios
  const [sameCondition, setSameCondition] = useState<boolean | null>(null)

  const isCheckout   = type === 'checkout'
  const title        = isCheckout ? 'Inspección de entrega (checkout)' : 'Inspección de recepción (check-in)'
  const hasBaseline  = baselinePhotos.length > 0

  // Si hay fotos base y el usuario confirmó mismo estado, no se requieren fotos nuevas
  const needsPhotos = !hasBaseline || sameCondition === false

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/reservas/${reservationId}/inspecciones`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Inspecciones
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{vehicleLabel}</p>
      </div>

      <form action={action} className="space-y-6">
        {/* Campos ocultos */}
        <input type="hidden" name="type"          value={type} />
        <input type="hidden" name="inspection_id" value={inspectionId} />
        <input type="hidden" name="damage_points" value={JSON.stringify(damagePoints)} />
        <input type="hidden" name="photo_paths"   value={JSON.stringify(photoPaths)} />

        {state.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}

        {/* Odómetro y combustible */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Estado del vehículo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Odómetro (km) *</label>
              <input
                type="number"
                name="odometer"
                disabled={pending}
                placeholder="45000"
                min="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
              />
              {state.fieldErrors?.odometer && (
                <p className="mt-1 text-xs text-red-600">{state.fieldErrors.odometer[0]}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nivel de combustible *</label>
              <select
                name="fuel_level"
                disabled={pending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              >
                {Object.entries(FUEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Diagrama de daños */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-4">Daños visibles</h2>
          <DamageMap onChange={setDamagePoints} />
        </div>

        {/* ── Fotos base del vehículo ─────────────────────────────────────── */}
        {hasBaseline && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
                Estado de carrocería registrado
              </h2>
              <p className="text-xs text-gray-500 mt-2">
                Estas son las fotos base del vehículo. Verifica que el estado actual coincida.
              </p>
            </div>

            {/* Grid de fotos base */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {baselinePhotos.map(photo => (
                <div key={photo.id} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.signedUrl}
                    alt={photo.angle ? (ANGLE_LABELS[photo.angle] ?? photo.angle) : 'Foto'}
                    className="w-full h-full object-cover"
                  />
                  {photo.angle && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-xs font-medium bg-black/60 text-white rounded">
                      {ANGLE_LABELS[photo.angle] ?? photo.angle}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Pregunta de estado */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-medium text-gray-800 mb-3">
                ¿El vehículo se encuentra en el mismo estado de carrocería que las fotos registradas?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setSameCondition(true); setPhotoPaths([]) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg border transition-colors font-medium ${
                    sameCondition === true
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-green-500 hover:text-green-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Sí, mismo estado
                </button>
                <button
                  type="button"
                  onClick={() => setSameCondition(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg border transition-colors font-medium ${
                    sameCondition === false
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-red-500 hover:text-red-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  No, hay cambios
                </button>
              </div>

              {/* Confirmación: mismo estado */}
              {sameCondition === true && (
                <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs">Estado de carrocería confirmado. No se requieren fotos adicionales.</p>
                </div>
              )}

              {/* Aviso: hay cambios */}
              {sameCondition === false && (
                <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs">Documenta los cambios con fotos en la sección de abajo.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Fotos nuevas (condicional) ───────────────────────────────────── */}
        {needsPhotos && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-4">
              {sameCondition === false
                ? 'Fotografías de los cambios detectados'
                : 'Fotografías del vehículo'}
            </h2>
            <PhotoUploader
              inspectionId={inspectionId}
              tenantId={tenantId}
              onChange={setPhotoPaths}
            />
          </div>
        )}

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas adicionales</label>
          <textarea
            name="notes"
            rows={3}
            disabled={pending}
            placeholder="Observaciones generales del vehículo al momento de la inspección..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
          />
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Link
            href={`/dashboard/reservas/${reservationId}/inspecciones`}
            className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {pending ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Guardando...
              </>
            ) : `Guardar ${isCheckout ? 'entrega' : 'recepción'}`}
          </button>
        </div>
      </form>
    </div>
  )
}
