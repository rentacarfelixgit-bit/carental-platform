'use client'

// src/app/dashboard/reservas/calendario/EventModal.tsx
// Crear / ver / editar un evento de agenda. Se abre desde el "+" del día o al tocar un evento.

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  EVENT_TYPES, EVENT_TYPE_KEYS, type CalendarEventRow, type CalendarEventType,
} from '@/lib/calendarEvents'
import {
  saveCalendarEvent, setCalendarEventDone, deleteCalendarEvent, listRentalsForEvents,
} from './actions'

interface Props {
  /** Evento existente (editar) o null (nuevo) */
  event: CalendarEventRow | null
  /** Fecha por defecto para un evento nuevo (YYYY-MM-DD) */
  defaultDate: string
  /** Renta precargada (ej. al crear desde el detalle de una renta) */
  defaultReservation?: { id: string; label: string } | null
  onClose: () => void
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export default function EventModal({ event, defaultDate, defaultReservation = null, onClose }: Props) {
  const router = useRouter()
  const isNew = !event
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [type,  setType]  = useState<CalendarEventType>(event?.type ?? 'scheduled_return')
  const [title, setTitle] = useState(event?.title ?? EVENT_TYPES.scheduled_return.defaultTitle)
  const [titleTouched, setTitleTouched] = useState(!!event)
  const [date,  setDate]  = useState(event?.event_date ?? defaultDate)
  const [time,  setTime]  = useState(event?.event_time?.slice(0, 5) ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [reservationId, setReservationId] = useState(event?.reservation_id ?? defaultReservation?.id ?? '')

  // Rentas abiertas para ligar el evento
  const [rentals, setRentals] = useState<{ id: string; label: string }[] | null>(null)
  const [rentalQuery, setRentalQuery] = useState('')
  useEffect(() => {
    let alive = true
    listRentalsForEvents().then(list => { if (alive) setRentals(list) })
    return () => { alive = false }
  }, [])

  // Asegurar que la renta ya ligada aparezca aunque ya no esté abierta
  const rentalOptions = useMemo(() => {
    const list = rentals ?? []
    const current = event?.reservation_id && event.rental_label
      ? { id: event.reservation_id, label: event.rental_label }
      : defaultReservation
    const all = current && !list.some(r => r.id === current.id) ? [current, ...list] : list
    const q = rentalQuery.trim().toLowerCase()
    return q ? all.filter(r => r.label.toLowerCase().includes(q) || r.id === reservationId) : all
  }, [rentals, rentalQuery, event, defaultReservation, reservationId])

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function pickType(t: CalendarEventType) {
    setType(t)
    if (!titleTouched) setTitle(EVENT_TYPES[t].defaultTitle)
  }

  function run(fn: () => Promise<{ error?: string }>, close = true) {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (res?.error) { setError(res.error); return }
      router.refresh()
      if (close) onClose()
    })
  }

  function save() {
    run(() => saveCalendarEvent({
      id: event?.id, type, title, notes, event_date: date, event_time: time, reservation_id: reservationId,
    }))
  }

  const cfg = EVENT_TYPES[type]
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.chip}`}>
              <Icon d={cfg.icon} className="w-5 h-5" />
            </span>
            <div>
              <h2 id="event-modal-title" className="text-base font-semibold text-gray-900">
                {isNew ? 'Nuevo evento' : 'Evento'}
              </h2>
              {!isNew && event?.done && <p className="text-xs text-green-600 font-medium">Hecho</p>}
              {!isNew && !event?.done && <p className="text-xs text-orange-600 font-medium">Pendiente</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-gray-600">
            <Icon d="M6 18L18 6M6 6l12 12" className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {/* Quién hizo qué */}
          {!isNew && (event?.created_by_name || event?.done_by_name) && (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 space-y-0.5">
              {event?.created_by_name && (
                <p>Creado por <span className="font-medium text-gray-700">{event.created_by_name}</span>
                  {event.created_at && <> · {new Date(event.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</>}
                </p>
              )}
              {event?.done && (
                <p className="text-green-700">Hecho por <span className="font-medium">{event.done_by_name ?? '—'}</span>
                  {event.done_at && <> · {new Date(event.done_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</>}
                </p>
              )}
            </div>
          )}

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de evento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EVENT_TYPE_KEYS.map(t => {
                const c = EVENT_TYPES[t]
                const selected = t === type
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickType(t)}
                    disabled={pending}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs text-left transition-colors ${
                      selected ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label htmlFor="ev-title" className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input
              id="ev-title" type="text" value={title} maxLength={150} disabled={pending}
              onChange={e => { setTitle(e.target.value); setTitleTouched(true) }}
              placeholder="Ej. Recoger silla de bebé"
              className={inputCls}
            />
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev-date" className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input id="ev-date" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={pending} className={inputCls} />
            </div>
            <div>
              <label htmlFor="ev-time" className="block text-xs font-medium text-gray-600 mb-1">Hora (opcional)</label>
              <input id="ev-time" type="time" value={time} onChange={e => setTime(e.target.value)} disabled={pending} className={inputCls} />
            </div>
          </div>

          {/* Renta ligada */}
          <div>
            <label htmlFor="ev-rental" className="block text-xs font-medium text-gray-600 mb-1">
              Reserva o contrato <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text" value={rentalQuery} onChange={e => setRentalQuery(e.target.value)} disabled={pending}
              placeholder="Filtrar por folio, cliente o placa…"
              className={`${inputCls} mb-1.5`}
            />
            <select
              id="ev-rental" value={reservationId} onChange={e => setReservationId(e.target.value)} disabled={pending || rentals === null}
              className={`${inputCls} bg-white`}
            >
              <option value="">{rentals === null ? 'Cargando rentas…' : '— Sin renta ligada —'}</option>
              {rentalOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            {reservationId && (
              <Link href={`/dashboard/reservas/${reservationId}`} className="inline-block mt-1 text-xs text-blue-600 hover:underline">
                Ver renta →
              </Link>
            )}
          </div>

          {/* Notas */}
          <div>
            <label htmlFor="ev-notes" className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea
              id="ev-notes" rows={3} value={notes} maxLength={2000} disabled={pending}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles para el equipo…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          {!isNew && (
            <>
              <button
                type="button" disabled={pending}
                onClick={() => run(() => setCalendarEventDone(event!.id, !event!.done))}
                className={`text-sm px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                  event!.done ? 'border-gray-300 text-gray-600 hover:bg-white' : 'border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                {event!.done ? 'Marcar pendiente' : 'Marcar como hecho'}
              </button>
              <button
                type="button" disabled={pending}
                onClick={() => { if (confirm('¿Eliminar este evento?')) run(() => deleteCalendarEvent(event!.id)) }}
                className="text-sm px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            </>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} disabled={pending}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={pending || !title.trim() || !date}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50">
            {pending ? 'Guardando…' : isNew ? 'Agregar evento' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
