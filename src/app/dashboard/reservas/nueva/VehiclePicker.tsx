'use client'

// src/app/dashboard/reservas/nueva/VehiclePicker.tsx
// Selector de vehículo con búsqueda: se puede abrir la lista o escribir marca, modelo,
// año, color o placas para filtrar. Teclado: ↑ ↓ para moverse, Enter para elegir, Esc para cerrar.

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface PickerVehicle {
  id: string; plates: string; brand: string; model: string; year: number; color: string; daily_rate?: number | null
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const labelOf = (v: PickerVehicle) => `${v.brand} ${v.model} ${v.year} · ${v.color}`

export default function VehiclePicker({ vehicles, value, onChange, disabled, name = 'vehicle_id' }: {
  vehicles: PickerVehicle[]
  value: PickerVehicle | null
  onChange: (v: PickerVehicle | null) => void
  disabled?: boolean
  name?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const filtered = useMemo(() => {
    const terms = norm(query).split(/\s+/).filter(Boolean)
    if (!terms.length) return vehicles
    return vehicles.filter(v => {
      const hay = norm(`${v.brand} ${v.model} ${v.year} ${v.color} ${v.plates}`)
      return terms.every(t => hay.includes(t))
    })
  }, [vehicles, query])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function choose(v: PickerVehicle) {
    onChange(v); setQuery(''); setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { if (open && filtered[active]) { e.preventDefault(); choose(filtered[active]) } }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={value?.id ?? ''} />
      <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 bg-white ${open ? 'border-blue-400 ring-2 ring-blue-500/30' : 'border-gray-300'} ${disabled ? 'opacity-50' : ''}`}>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={open ? query : value ? labelOf(value) : query}
          placeholder={value ? labelOf(value) : 'Escribe marca, modelo, color o placas…'}
          onFocus={() => { setOpen(true); setQuery(''); setActive(0) }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
        />
        {value && !disabled && (
          <button type="button" onClick={() => { onChange(null); setQuery(''); setOpen(true) }}
            className="text-gray-400 hover:text-gray-600" aria-label="Quitar vehículo">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600" aria-label="Ver lista">
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {open && (
        <ul ref={listRef} id={listId} role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-400">Ningún vehículo coincide con &ldquo;{query}&rdquo;.</li>
          ) : filtered.map((v, i) => (
            <li key={v.id} data-idx={i} role="option" aria-selected={value?.id === v.id}>
              <button type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(v)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 ${i === active ? 'bg-blue-50' : ''} ${value?.id === v.id ? 'font-medium' : ''}`}>
                <span className="text-sm text-gray-900 truncate">{labelOf(v)}</span>
                <span className="text-xs font-mono text-gray-500 whitespace-nowrap">{v.plates}{v.daily_rate ? ` · US$${Number(v.daily_rate).toFixed(2)}/día` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
