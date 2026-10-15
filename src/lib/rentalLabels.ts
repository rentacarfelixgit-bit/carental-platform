// src/lib/rentalLabels.ts
// Reservas y contratos de mostrador comparten la tabla `reservations` y el mismo flujo
// de estados (pending → confirmed → active → completed / cancelled). Aquí se centraliza
// cómo se llama cada cosa según su origen, para que todo el sistema los muestre igual.

export type RentalOrigin = 'reservation' | 'walk_in'

export interface StatusStyle { label: string; className: string }

/** Estados vistos como reserva */
export const RESERVATION_STATUS: Record<string, StatusStyle> = {
  pending:   { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada', className: 'bg-blue-100 text-blue-700'    },
  active:    { label: 'En curso',   className: 'bg-green-100 text-green-700'  },
  completed: { label: 'Completada', className: 'bg-gray-100 text-gray-600'    },
  cancelled: { label: 'Cancelada',  className: 'bg-red-100 text-red-600'      },
}

/** Estados vistos como contrato de mostrador (nace en `confirmed`, nunca pasa por `pending`) */
export const CONTRACT_STATUS: Record<string, StatusStyle> = {
  confirmed: { label: 'Abierto · Por entregar', className: 'bg-blue-100 text-blue-700'   },
  active:    { label: 'Abierto · En uso',       className: 'bg-green-100 text-green-700' },
  completed: { label: 'Contrato cerrado',       className: 'bg-gray-100 text-gray-600'   },
  cancelled: { label: 'Cancelado',              className: 'bg-red-100 text-red-600'     },
}

export function statusStyle(status: string, origin: RentalOrigin | string = 'reservation'): StatusStyle {
  const table = origin === 'walk_in' ? CONTRACT_STATUS : RESERVATION_STATUS
  return table[status] ?? RESERVATION_STATUS[status] ?? RESERVATION_STATUS.pending
}

/** Estados que cuentan como "contrato abierto" */
export const OPEN_CONTRACT_STATUSES   = ['confirmed', 'active'] as const
/** Estados que van en la pestaña "Cerrados" */
export const CLOSED_CONTRACT_STATUSES = ['completed', 'cancelled'] as const

/** Folio visible: R-0001 para reservas, C-0001 para contratos */
export function rentalFolio(origin: RentalOrigin | string | null | undefined, number: number | null | undefined): string {
  if (!number) return '—'
  return `${origin === 'walk_in' ? 'C' : 'R'}-${String(number).padStart(4, '0')}`
}

/** Nombre del tipo de renta para títulos ("Reserva" / "Contrato") */
export function rentalKind(origin: RentalOrigin | string | null | undefined) {
  return origin === 'walk_in' ? 'Contrato' : 'Reserva'
}

/** Título completo según origen y estado: "Contrato abierto", "Contrato cerrado", "Reserva"... */
export function rentalTitle(origin: RentalOrigin | string | null | undefined, status: string) {
  if (origin !== 'walk_in') return 'Reserva'
  if (status === 'completed') return 'Contrato cerrado'
  if (status === 'cancelled') return 'Contrato cancelado'
  return 'Contrato abierto'
}

/** Sección a la que pertenece (para enlaces de "volver") */
export function rentalSection(origin: RentalOrigin | string | null | undefined) {
  return origin === 'walk_in'
    ? { href: '/dashboard/contratos', label: 'Contratos' }
    : { href: '/dashboard/reservas',  label: 'Reservas' }
}
