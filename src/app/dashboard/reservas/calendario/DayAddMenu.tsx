'use client'

// src/app/dashboard/reservas/calendario/DayAddMenu.tsx
// Botón "+" de cada día: Nueva reserva · Nuevo contrato · Nuevo evento.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import EventModal from './EventModal'

export default function DayAddMenu({ date, variant = 'hover' }: { date: string; variant?: 'hover' | 'mobile' }) {
  const [open, setOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const item = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Agregar en este día"
        aria-expanded={open}
        className={variant === 'hover'
          ? `${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'} transition-opacity w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center`
          : 'w-7 h-7 rounded-full border border-gray-200 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center transition-colors'}
      >
        <svg className={variant === 'hover' ? 'w-3 h-3 text-blue-600' : 'w-3.5 h-3.5 text-gray-500'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          <Link href={`/dashboard/reservas/nueva?start=${date}`} className={item}>
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Nueva reserva
          </Link>
          <Link href={`/dashboard/contratos/nuevo`} className={item}>
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Nuevo contrato
          </Link>
          <div className="my-1 border-t border-gray-100" />
          <button type="button" className={item} onClick={() => { setOpen(false); setEventOpen(true) }}>
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Nuevo evento…
          </button>
        </div>
      )}

      {eventOpen && <EventModal event={null} defaultDate={date} onClose={() => setEventOpen(false)} />}
    </div>
  )
}
