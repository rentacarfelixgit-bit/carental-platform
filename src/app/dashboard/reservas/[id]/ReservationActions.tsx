'use client'

// src/app/dashboard/reservas/[id]/ReservationActions.tsx
// Botones de cambio de estado según el estado actual y el rol del usuario.
// Para "en curso" y "completada" verifica si existe inspección; si no, muestra
// InspectionGateModal para capturar odómetro/combustible antes de continuar.

import { useState, useTransition } from 'react'
import { changeReservationStatus } from '../actions'
import InspectionGateModal from './InspectionGateModal'

type AllowedStatus = 'confirmed' | 'active' | 'completed' | 'cancelled'

interface Action {
  label: string
  status: AllowedStatus
  className: string
  confirm?: string
}

const ACTIONS_BY_STATUS: Record<string, Action[]> = {
  pending: [
    { label: 'Confirmar reserva', status: 'confirmed', className: 'bg-blue-600 hover:bg-blue-700 text-white', confirm: '¿Confirmar esta reserva?' },
    { label: 'Cancelar reserva',  status: 'cancelled', className: 'border border-red-200 text-red-600 hover:bg-red-50', confirm: '¿Cancelar esta reserva?' },
  ],
  confirmed: [
    { label: 'Marcar en curso',  status: 'active',    className: 'bg-green-600 hover:bg-green-700 text-white' },
    { label: 'Cancelar reserva', status: 'cancelled', className: 'border border-red-200 text-red-600 hover:bg-red-50', confirm: '¿Cancelar esta reserva?' },
  ],
  active: [
    { label: 'Marcar completada', status: 'completed', className: 'bg-gray-700 hover:bg-gray-800 text-white' },
  ],
}

interface Props {
  reservationId: string
  currentStatus: string
  isAdmin: boolean
  hasCheckout: boolean
  hasCheckin: boolean
}

export default function ReservationActions({
  reservationId,
  currentStatus,
  isAdmin,
  hasCheckout,
  hasCheckin,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [gateType, setGateType] = useState<'checkout' | 'checkin' | null>(null)

  const actions = ACTIONS_BY_STATUS[currentStatus] ?? []

  // Confirmar requiere admin
  const visibleActions = isAdmin
    ? actions
    : actions.filter(a => a.status !== 'confirmed')

  if (visibleActions.length === 0) return null

  function handleAction(action: Action) {
    // Transición a "en curso": requiere inspección de salida
    if (action.status === 'active' && !hasCheckout) {
      setGateType('checkout')
      return
    }

    // Transición a "completada": requiere inspección de regreso
    if (action.status === 'completed' && !hasCheckin) {
      setGateType('checkin')
      return
    }

    // Para el resto de acciones (confirmed, cancelled) o cuando la inspección ya existe
    if (action.confirm && !confirm(action.confirm)) return

    startTransition(async () => {
      const result = await changeReservationStatus(reservationId, action.status)
      if (result?.error) alert(result.error)
    })
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visibleActions.map(a => (
          <button
            key={a.status}
            onClick={() => handleAction(a)}
            disabled={pending}
            className={`text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${a.className}`}
          >
            {pending ? 'Procesando...' : a.label}
          </button>
        ))}
      </div>

      {gateType && (
        <InspectionGateModal
          reservationId={reservationId}
          type={gateType}
          onClose={() => setGateType(null)}
        />
      )}
    </>
  )
}
