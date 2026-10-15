// src/app/dashboard/reservas/nueva/page.tsx
// Nueva reserva. Si viene desde el calendario, los params start/end/vehicle pre-llenan el form.

import NuevaReservaForm from './NuevaReservaForm'
import { loadRentalFormData } from './loadFormData'

interface Props {
  searchParams: Promise<{ start?: string; end?: string; vehicle?: string }>
}

// Convertir fecha sola (YYYY-MM-DD) a datetime-local (YYYY-MM-DDTHH:MM)
function toDatetime(val?: string, defaultTime = '08:00') {
  if (!val) return ''
  if (val.includes('T')) return val          // ya tiene hora
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T${defaultTime}`
  return val
}

export default async function NuevaReservaPage({ searchParams }: Props) {
  const { start, end, vehicle } = await searchParams
  const { clients, defaultPrices } = await loadRentalFormData()

  return (
    <NuevaReservaForm
      clients={clients}
      initialStartDate={toDatetime(start, '08:00')}
      initialEndDate={toDatetime(end, '08:00')}
      initialVehicleId={vehicle ?? ''}
      defaultPrices={defaultPrices}
    />
  )
}
