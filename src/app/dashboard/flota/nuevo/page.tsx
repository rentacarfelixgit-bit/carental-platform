'use client'

// src/app/dashboard/flota/nuevo/page.tsx

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createVehicle } from '../actions'
import VehicleForm from '../VehicleForm'

export default function NuevoVehiculoPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createVehicle, {})

  useEffect(() => {
    if (state.success) router.push('/dashboard/flota')
  }, [state.success, router])

  return (
    <VehicleForm
      action={action}
      state={state}
      pending={pending}
      title="Agregar vehículo"
      submitLabel="Agregar vehículo"
    />
  )
}
