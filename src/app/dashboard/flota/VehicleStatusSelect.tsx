'use client'

import { useTransition, useState } from 'react'
import { changeVehicleStatus, checkVehicleActiveReservation } from './actions'

interface ActiveReservation {
  id: string
  status: string
  start_date: string
  end_date: string
  client_name: string
}

interface Props {
  vehicleId: string
  currentStatus: string
  statuses: { value: string; label: string }[]
  statusConfig: Record<string, { label: string; className: string }>
  isAdmin: boolean
}

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmada',
  active:    'Activa',
}

export default function VehicleStatusSelect({ vehicleId, currentStatus, statuses, statusConfig, isAdmin }: Props) {
  const [pending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus]         = useState<string | null>(null)
  const [activeReservation, setActiveReservation] = useState<ActiveReservation | null>(null)
  const [showModal, setShowModal]                 = useState(false)
  const [selectKey, setSelectKey]                 = useState(0) // force reset

  const cfg             = statusConfig[currentStatus] ?? { label: currentStatus, className: 'bg-gray-100 text-gray-600' }
  const currentInList   = statuses.some(s => s.value === currentStatus)

  function doChange(newStatus: string) {
    startTransition(async () => {
      await changeVehicleStatus(vehicleId, newStatus)
    })
  }

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    if (!newStatus || newStatus === currentStatus) return

    // Admins: antes de cambiar, verificar si hay reserva activa vinculada
    if (isAdmin) {
      const reservation = await checkVehicleActiveReservation(vehicleId)
      if (reservation) {
        setPendingStatus(newStatus)
        setActiveReservation(reservation)
        setShowModal(true)
        // Reset visual del select
        setSelectKey(k => k + 1)
        return
      }
    }

    doChange(newStatus)
  }

  function confirmChange() {
    if (!pendingStatus) return
    setShowModal(false)
    doChange(pendingStatus)
    setPendingStatus(null)
    setActiveReservation(null)
  }

  function cancelModal() {
    setShowModal(false)
    setPendingStatus(null)
    setActiveReservation(null)
  }

  return (
    <>
      <select
        key={selectKey}
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={pending}
        className={`text-xs font-medium px-2 py-1 rounded-md border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${cfg.className}`}
      >
        {/* Si el estado actual no está en la lista (ej. operador viendo "Disponible"), mostrarlo como opción deshabilitada */}
        {!currentInList && (
          <option value={currentStatus} disabled>
            {statusConfig[currentStatus]?.label ?? currentStatus}
          </option>
        )}
        {statuses.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Overlay de guardando */}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/30 backdrop-blur-sm" role="status">
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-xl">
            <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Guardando estado...
          </div>
        </div>
      )}

      {/* Modal de advertencia — solo admins con reserva activa */}
      {showModal && activeReservation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Reserva activa vinculada</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Este vehículo tiene una reserva activa. Cambiar el estado manualmente puede romper el flujo de esa reserva.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm space-y-1">
              <p className="font-medium text-amber-900 mb-1">Reserva afectada</p>
              <p className="text-amber-800">
                <span className="font-medium">Cliente:</span> {activeReservation.client_name}
              </p>
              <p className="text-amber-800">
                <span className="font-medium">Estado:</span> {RESERVATION_STATUS_LABELS[activeReservation.status] ?? activeReservation.status}
              </p>
              <p className="text-amber-800">
                <span className="font-medium">Período:</span>{' '}
                {new Date(activeReservation.start_date + 'T12:00:00').toLocaleDateString('es-DO')}
                {' – '}
                {new Date(activeReservation.end_date + 'T12:00:00').toLocaleDateString('es-DO')}
              </p>
              <a
                href={`/dashboard/reservas/${activeReservation.id}`}
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                Ver reserva →
              </a>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              Si continúas, el estado cambiará y <strong>no se actualizará automáticamente</strong> hasta que un administrador lo establezca en <strong>Disponible</strong>.
            </p>

            <div className="flex gap-3">
              <button
                onClick={cancelModal}
                className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmChange}
                className="flex-1 py-2.5 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
              >
                Sí, cambiar igual
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
