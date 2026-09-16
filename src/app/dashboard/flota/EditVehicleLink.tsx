'use client'

import Link from 'next/link'
import { useState, type MouseEvent } from 'react'

interface Props {
  vehicleId: string
}

export default function EditVehicleLink({ vehicleId }: Props) {
  const [loading, setLoading] = useState(false)

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    setLoading(true)
  }

  return (
    <>
      <Link
        href={`/dashboard/flota/${vehicleId}/editar`}
        onClick={handleClick}
        aria-busy={loading}
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Editar
      </Link>

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/30 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-xl">
            <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando vehículo...
          </div>
        </div>
      )}
    </>
  )
}
