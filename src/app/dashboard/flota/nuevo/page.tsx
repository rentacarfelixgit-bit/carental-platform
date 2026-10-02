'use client'

// src/app/dashboard/flota/nuevo/page.tsx

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVehicle } from '../actions'
import VehicleForm from '../VehicleForm'

export default function NuevoVehiculoPage() {
  const router   = useRouter()
  const intentRef = useRef<'save' | 'save_and_add'>('save')

  const [state, action, pending] = useActionState(createVehicle, {})

  // Controla si mostrar el toast de "guardado" y la key del form para resetearlo
  const [savedCount, setSavedCount] = useState(0)
  const [formKey, setFormKey]       = useState(0)

  useEffect(() => {
    if (!state.success) return

    if (intentRef.current === 'save_and_add') {
      setSavedCount(n => n + 1)
      setFormKey(k => k + 1)   // re-monta el form en blanco
    } else {
      router.push('/dashboard/flota')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <div>
      {savedCount > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 mb-2">
            <svg className="w-4 h-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {savedCount === 1
              ? 'Vehículo guardado. Puedes agregar otro a continuación.'
              : `${savedCount} vehículos guardados. Puedes agregar otro.`}
          </div>
        </div>
      )}

      <VehicleForm
        key={formKey}
        action={action}
        state={state.success ? {} : state}
        pending={pending}
        title="Agregar vehículo"
        submitLabel="Agregar vehículo"
        onSaveAndAddAnother={() => { intentRef.current = 'save_and_add' }}
        onSave={() => { intentRef.current = 'save' }}
      />
    </div>
  )
}
