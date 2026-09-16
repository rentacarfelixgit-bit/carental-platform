'use client'

// src/app/dashboard/flota/[id]/editar/ToggleVehicleButton.tsx

import { useState, useTransition } from 'react'
import { toggleVehicleActive } from '../../actions'

interface Props {
  vehicleId: string
  active: boolean
}

export default function ToggleVehicleButton({ vehicleId, active }: Props) {
  const [isActive, setIsActive] = useState(active)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    const next = !isActive
    startTransition(async () => {
      const result = await toggleVehicleActive(vehicleId, next)
      if (!result?.error) setIsActive(next)
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-6 pb-6">
      <button
        onClick={handleToggle}
        disabled={pending}
        aria-busy={pending}
        className={`w-full py-2.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${
          isActive
            ? 'border-red-200 text-red-700 hover:bg-red-50'
            : 'border-green-200 text-green-700 hover:bg-green-50'
        }`}
      >
        {pending ? 'Guardando...' : isActive ? 'Desactivar vehículo' : 'Reactivar vehículo'}
      </button>
    </div>
  )
}
