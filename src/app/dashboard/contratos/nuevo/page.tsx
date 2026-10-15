// src/app/dashboard/contratos/nuevo/page.tsx
// Nuevo contrato (cliente en mostrador, sin reserva). Reutiliza el formulario de reserva
// en modo "contract": misma captura, mismo flujo; la salida se precarga con la hora actual.

import NuevaReservaForm from '../../reservas/nueva/NuevaReservaForm'
import { loadRentalFormData, nowInTimezone } from '../../reservas/nueva/loadFormData'
import { parseCalendarReturn } from '@/lib/calendarReturn'

interface Props {
  searchParams: Promise<{ from?: string; mes?: string; dia?: string; vista?: string }>
}

export default async function NuevoContratoPage({ searchParams }: Props) {
  const sp = await searchParams
  const { clients, defaultPrices, timezone } = await loadRentalFormData()

  return (
    <NuevaReservaForm
      mode="contract"
      clients={clients}
      initialStartDate={nowInTimezone(timezone)}
      defaultPrices={defaultPrices}
      calendarReturn={parseCalendarReturn(sp)}
    />
  )
}
