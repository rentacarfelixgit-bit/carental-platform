'use client'

import { useTransition } from 'react'
import { changeVehicleStatus } from './actions'

interface Props {
  vehicleId: string
  currentStatus: string
  statuses: { value: string; label: string }[]
  statusConfig: Record<string, { label: string; className: string }>
}

export default function VehicleStatusSelect({ vehicleId, currentStatus, statuses, statusConfig }: Props) {
  const [pending, startTransition] = useTransition()
  const cfg = statusConfig[currentStatus] ?? statusConfig.available

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    startTransition(async () => {
      await changeVehicleStatus(vehicleId, newStatus)
    })
  }

  return (
    <>
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={pending}
        aria-busy={pending}
        className={`text-xs font-medium px-2 py-1 rounded-md border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${cfg.className}`}
      >
        {statuses.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/30 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-xl">
            <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Guardando estado...
          </div>
        </div>
      )}
    </>
  )
}
