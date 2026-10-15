// src/app/dashboard/contratos/nuevo/page.tsx
// Nuevo contrato (cliente en mostrador, sin reserva). Reutiliza el formulario de reserva
// en modo "contract": misma captura, mismo flujo; la salida se precarga con la hora actual.

import NuevaReservaForm from '../../reservas/nueva/NuevaReservaForm'
import { loadRentalFormData, nowInTimezone } from '../../reservas/nueva/loadFormData'

export default async function NuevoContratoPage() {
  const { clients, defaultPrices, timezone } = await loadRentalFormData()

  return (
    <NuevaReservaForm
      mode="contract"
      clients={clients}
      initialStartDate={nowInTimezone(timezone)}
      defaultPrices={defaultPrices}
    />
  )
}
