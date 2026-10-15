'use client'

// src/app/dashboard/reservas/calendario/RentalEvents.tsx
// Eventos de agenda ligados a una renta (se muestra en el detalle de reserva / contrato).

import { useState } from 'react'
import EventChip from './EventChip'
import EventModal from './EventModal'
import type { CalendarEventRow } from '@/lib/calendarEvents'

interface Props {
  reservationId: string
  rentalLabel: string
  events: CalendarEventRow[]
  defaultDate: string
}

export default function RentalEvents({ reservationId, rentalLabel, events, defaultDate }: Props) {
  const [adding, setAdding] = useState(false)
  const pending = events.filter(e => !e.done).length

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
        <h2 className="text-sm font-medium text-gray-700">
          Agenda
          {pending > 0 && <span className="ml-2 text-xs font-normal text-orange-600">{pending} pendiente{pending !== 1 ? 's' : ''}</span>}
        </h2>
        <button type="button" onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:underline">
          + Agregar evento
        </button>
      </div>
      {events.length > 0 ? (
        <ul className="space-y-1.5">
          {events.map(ev => (
            <li key={ev.id} className="flex items-center gap-3">
              <span className="w-20 flex-shrink-0 text-xs text-gray-500">
                {new Date(`${ev.event_date}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
              </span>
              <div className="flex-1 min-w-0"><EventChip event={ev} size="md" /></div>
              {ev.done && ev.done_by_name && (
                <span className="hidden sm:block flex-shrink-0 text-xs text-green-700">✓ {ev.done_by_name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">Sin eventos. Agrega retornos programados, recolección de equipo o notas para el equipo.</p>
      )}
      {adding && (
        <EventModal
          event={null}
          defaultDate={defaultDate}
          defaultReservation={{ id: reservationId, label: rentalLabel }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
