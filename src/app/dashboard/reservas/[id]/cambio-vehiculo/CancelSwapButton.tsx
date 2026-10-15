'use client'

// src/app/dashboard/reservas/[id]/cambio-vehiculo/CancelSwapButton.tsx

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelVehicleSwap } from './actions'

export default function CancelSwapButton({ swapId }: { swapId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="text-right">
      <button type="button" disabled={pending}
        onClick={() => {
          if (!confirm('¿Cancelar el cambio de vehículo? El vehículo nuevo vuelve a quedar disponible.')) return
          setError('')
          start(async () => {
            const res = await cancelVehicleSwap(swapId)
            if (res.error) setError(res.error)
            else router.refresh()
          })
        }}
        className="text-sm px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">
        {pending ? 'Cancelando…' : 'Cancelar cambio'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1 max-w-xs ml-auto">{error}</p>}
    </div>
  )
}
