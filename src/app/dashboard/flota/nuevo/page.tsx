'use client'

// src/app/dashboard/flota/nuevo/page.tsx

import { useActionState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createVehicle } from '../actions'
import VehicleForm from '../VehicleForm'

export default function NuevoVehiculoPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createVehicle, {})
  const [addAnother, setAddAnother]   = useState(false)
  const [resetKey, setResetKey]       = useState(0)   // fuerza re-mount del form
  const intentRef = useRef<string>('save')

  // Interceptar el FormData para leer el intent antes de enviarlo
  const wrappedAction = useCallback((formData: FormData) => {
    intentRef.current = (formData.get('_intent') as string) ?? 'save'
    return action(formData)
  }, [action])

  useEffect(() => {
    if (!state.success) return
    if (intentRef.current === 'save_and_add') {
      // Limpiar form y quedar en la misma página
      setResetKey(k => k + 1)
      setAddAnother(true)
    } else {
      router.push('/dashboard/flota')
    }
  }, [state.success, router])

  return (
    <div>
      {addAnother && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 mb-2">
            <svg className="w-4 h-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Vehículo guardado correctamente. Puedes agregar otro a continuación.
          </div>
        </div>
      )}
      <VehicleForm
        key={resetKey}
        action={wrappedAction}
        state={addAnother ? {} : state}
        pending={pending}
        title="Agregar vehículo"
        submitLabel="Agregar vehículo"
        onSaveAndAddAnother={() => {}}   // presencia activa el botón; la lógica real está en wrappedAction
      />
    </div>
  )
}
