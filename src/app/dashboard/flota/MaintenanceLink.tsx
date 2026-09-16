import Link from 'next/link'

interface Props {
  vehicleId: string
  hasOpenAlerts: boolean
}

export default function MaintenanceLink({ vehicleId, hasOpenAlerts }: Props) {
  return (
    <Link
      href={`/dashboard/flota/${vehicleId}/mantenimiento`}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
        hasOpenAlerts
          ? 'border-orange-300 text-orange-700 hover:bg-orange-50'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      Mant.
    </Link>
  )
}
