'use client'

// src/components/dashboard/rental/DropoffEditor.tsx
// Drop off: entregar o recoger el vehículo en otra ubicación. Se pueden agregar varias líneas
// (p. ej. recoge en Aeropuerto SDQ y devuelve en Aeropuerto PUJ), cada una con su precio.

import { MAX_DROPOFFS, type DropoffLocation } from '@/lib/reservationPrices'

export interface DropoffDraft { id: string; location: string; label: string; price: string }

let seq = 0
export const newDropoff = (locations: DropoffLocation[]): DropoffDraft =>
  ({ id: `d${Date.now()}${seq++}`, location: locations[0]?.code ?? 'otros', label: locations[0]?.label ?? '', price: '' })

/** Para el cálculo: "Otros" usa la descripción que se escribió */
export function dropoffsForBreakdown(lines: DropoffDraft[], locations: DropoffLocation[]) {
  return lines.map(l => ({
    location: l.location,
    label: l.location === 'otros'
      ? (l.label.trim() ? `Otros: ${l.label.trim()}` : 'Otros')
      : locations.find(x => x.code === l.location)?.label ?? l.label,
    price: parseFloat(l.price || '0') || 0,
  }))
}

export default function DropoffEditor({ lines, onChange, locations, disabled, compact = false }: {
  lines: DropoffDraft[]
  onChange: (lines: DropoffDraft[]) => void
  locations: DropoffLocation[]
  disabled?: boolean
  compact?: boolean
}) {
  const txt = compact ? 'text-xs' : 'text-sm'
  const update = (id: string, patch: Partial<DropoffDraft>) => onChange(lines.map(l => l.id === id ? { ...l, ...patch } : l))
  const ctl = 'px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50'

  return (
    <div className={`space-y-2 ${txt}`}>
      {lines.map((l, i) => (
        <div key={l.id} className="rounded-lg border border-gray-200 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500 w-4">{i + 1}.</span>
            <select value={l.location} disabled={disabled}
              onChange={e => {
                const loc = locations.find(x => x.code === e.target.value)
                update(l.id, { location: e.target.value, label: e.target.value === 'otros' ? '' : loc?.label ?? '' })
              }}
              className={`flex-1 min-w-0 ${ctl}`} aria-label="Ubicación del drop off">
              {locations.map(loc => <option key={loc.code} value={loc.code}>{loc.label}</option>)}
            </select>
            <button type="button" disabled={disabled} onClick={() => onChange(lines.filter(x => x.id !== l.id))}
              className="text-gray-400 hover:text-red-600 px-1" aria-label="Quitar drop off" title="Quitar">
              ✕
            </button>
          </div>
          {l.location === 'otros' && (
            <input type="text" value={l.label} maxLength={60} disabled={disabled} placeholder="¿Dónde? (hotel, ciudad…)"
              onChange={e => update(l.id, { label: e.target.value })} className={`w-full ${ctl} placeholder:text-gray-400`} />
          )}
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[10px] text-gray-400">US$</span>
            <input type="text" inputMode="decimal" placeholder="0.00" value={l.price} disabled={disabled}
              onChange={e => { const v = e.target.value; if (v === '' || /^\d{0,7}(\.\d{0,2})?$/.test(v)) update(l.id, { price: v }) }}
              className={`w-24 text-right ${ctl}`} aria-label="Precio del drop off" />
          </div>
        </div>
      ))}
      {lines.length < MAX_DROPOFFS && (
        <button type="button" disabled={disabled} onClick={() => onChange([...lines, newDropoff(locations)])}
          className="inline-flex items-center gap-1 text-[13px] text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50">
          <span className="text-base leading-none">+</span> {lines.length ? 'Agregar otro drop off' : 'Agregar drop off'}
        </button>
      )}
    </div>
  )
}
