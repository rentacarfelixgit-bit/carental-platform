// src/app/dashboard/reservas/StatusBadge.tsx
// Badge de estado. El texto cambia si la renta es un contrato de mostrador (origin = walk_in).

import { RESERVATION_STATUS, statusStyle } from '@/lib/rentalLabels'

/** Estados de reserva (se conserva el nombre por compatibilidad con los filtros existentes) */
export const STATUS_CONFIG = RESERVATION_STATUS

export default function StatusBadge({ status, origin = 'reservation' }: { status: string; origin?: string }) {
  const cfg = statusStyle(status, origin)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
