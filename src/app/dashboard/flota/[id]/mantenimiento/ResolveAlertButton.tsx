'use client'

// src/app/dashboard/flota/[id]/mantenimiento/ResolveAlertButton.tsx

import { useTransition } from 'react'
import { resolveMaintenanceAlert } from './actions'

interface Props {
  alertId: string
  vehicleId: string
}

export default function ResolveAlertButton({ alertId, vehicleId }: Props) {
  const [pending, startTransition] = useTransition()

  function handleResolve() {
    startTransition(async () => {
      await resolveMaintenanceAlert(alertId, vehicleId)
    })
  }

  return (
    <button
      onClick={handleResolve}
      disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
    >
      {pending ? 'Resolviendo...' : 'Resolver'}
    </button>
  )
}
