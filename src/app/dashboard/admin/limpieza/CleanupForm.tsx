'use client'

// src/app/dashboard/admin/limpieza/CleanupForm.tsx

import { useState, useTransition } from 'react'
import { previewCleanup, executeCleanup, type CleanupPreview } from './actions'

const RETENTION_OPTIONS = [
  { months: 6,  label: 'Más de 6 meses' },
  { months: 12, label: 'Más de 1 año' },
  { months: 24, label: 'Más de 2 años' },
  { months: 36, label: 'Más de 3 años' },
]

type Step = 'idle' | 'previewing' | 'preview' | 'confirming' | 'done'

export default function CleanupForm() {
  const [selectedMonths, setSelectedMonths] = useState(12)
  const [preview, setPreview] = useState<CleanupPreview | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [result, setResult] = useState<{ deleted: number; error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePreview() {
    setStep('previewing')
    setPreview(null)
    setResult(null)
    startTransition(async () => {
      const res = await previewCleanup(selectedMonths)
      if ('error' in res) {
        setResult({ deleted: 0, error: res.error })
        setStep('idle')
      } else {
        setPreview(res)
        setStep('preview')
      }
    })
  }

  function handleExecute() {
    setStep('confirming')
    startTransition(async () => {
      const res = await executeCleanup(selectedMonths)
      setResult(res)
      setPreview(null)
      setStep('done')
    })
  }

  return (
    <div className="space-y-6">
      {/* Selector de antigüedad */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Criterio de limpieza</h2>
        <p className="text-sm text-gray-500 mb-4">
          Elimina fotos de inspecciones de reservas <strong>completadas o canceladas</strong> cuya fecha de fin sea anterior al período seleccionado.
          Los registros de daños en texto <strong>no se eliminan</strong>.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RETENTION_OPTIONS.map(opt => (
            <button
              key={opt.months}
              type="button"
              onClick={() => { setSelectedMonths(opt.months); setPreview(null); setStep('idle'); setResult(null) }}
              className={`py-2.5 px-3 text-sm rounded-lg border transition-colors ${
                selectedMonths === opt.months
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handlePreview}
          disabled={isPending}
          className="mt-4 w-full sm:w-auto px-5 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {step === 'previewing' ? 'Calculando...' : 'Ver qué se eliminaría'}
        </button>
      </div>

      {/* Preview */}
      {step === 'preview' && preview && (
        <div className={`rounded-xl border p-5 ${preview.photoCount === 0 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          {preview.photoCount === 0 ? (
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700 font-medium">
                No hay fotos que eliminar con ese criterio. El storage está limpio.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-4">
                <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-orange-800">Se eliminarían permanentemente:</p>
                  <ul className="mt-1 text-sm text-orange-700 space-y-0.5">
                    <li><strong>{preview.photoCount}</strong> foto{preview.photoCount !== 1 ? 's' : ''} de inspección</li>
                    <li>De <strong>{preview.reservationCount}</strong> reserva{preview.reservationCount !== 1 ? 's' : ''} anteriores al {preview.cutoffDate}</li>
                  </ul>
                  <p className="mt-2 text-xs text-orange-600">Los registros de daños en texto permanecen intactos.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('idle'); setPreview(null) }}
                  className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecute}
                  disabled={isPending}
                  className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {step === 'confirming' ? 'Eliminando...' : 'Confirmar limpieza'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Resultado */}
      {step === 'done' && result && (
        <div className={`rounded-xl border p-5 ${result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {result.error ? (
            <p className="text-sm text-red-700"><strong>Error:</strong> {result.error}</p>
          ) : (
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700">
                <strong>{result.deleted}</strong> foto{result.deleted !== 1 ? 's' : ''} eliminada{result.deleted !== 1 ? 's' : ''} correctamente del storage.
              </p>
            </div>
          )}
          <button
            onClick={() => { setStep('idle'); setResult(null) }}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Hacer otra limpieza
          </button>
        </div>
      )}
    </div>
  )
}
