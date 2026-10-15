'use client'

// src/app/dashboard/reservas/calendario/EventChip.tsx
// Evento de agenda dentro del calendario. Al tocarlo abre el modal para verlo / editarlo.

import { useState } from 'react'
import EventModal from './EventModal'
import { eventTypeConfig, formatEventTime, type CalendarEventRow } from '@/lib/calendarEvents'

export default function EventChip({ event, size = 'sm' }: { event: CalendarEventRow; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false)
  const cfg = eventTypeConfig(event.type)
  const time = formatEventTime(event.event_time)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${cfg.label}: ${event.title}${event.rental_label ? ` · ${event.rental_label}` : ''}${event.done && event.done_by_name ? ` · Hecho por ${event.done_by_name}` : ''}`}
        className={`flex items-center gap-1 w-full text-left rounded ${cfg.chip} hover:brightness-95 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1.5 text-sm rounded-lg'
        } ${event.done ? 'opacity-50 line-through' : ''}`}
      >
        <svg className={`flex-shrink-0 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={event.done ? 'M4.5 12.75l6 6 9-13.5' : cfg.icon} />
        </svg>
        {time && <span className="flex-shrink-0 font-medium">{time}</span>}
        <span className="truncate">{event.title}</span>
      </button>
      {open && <EventModal event={event} defaultDate={event.event_date} onClose={() => setOpen(false)} />}
    </>
  )
}
