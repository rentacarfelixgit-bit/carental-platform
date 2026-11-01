'use client'

// src/app/dashboard/configuracion/DropoffLocationsForm.tsx
// Ubicaciones que aparecen en el menú de Drop off (entregar / recoger el vehículo en otro lugar).
// El precio se escribe en cada renta. "Otros" siempre está disponible con descripción libre.

import { useState, useTransition } from 'react'
import { saveDropoffLocations } from './actions'
import type { DropoffLocation } from '@/lib/reservationPrices'

const newCode = () => `loc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 30)

export default function DropoffLocationsForm({ locations, canEdit }: { locations: DropoffLocation[]; canEdit: boolean }) {
  const [list, setList] = useState(() => locations.filter(l => l.code !== 'otros'))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const disabled = !canEdit || pending
  const touch = () => { setSaved(false); setError('') }

  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; setList(n); touch()
  }

  function save() {
    if (list.some(l => !l.label.trim())) { setError('Escribe el nombre de cada ubicación (o elimínala).'); return }
    startTransition(async () => {
      const res = await saveDropoffLocations(list)
      if (res.error) setError(res.error); else setSaved(true)
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">Ubicaciones de Drop off</h3>
        <span className="text-xs text-gray-400">El precio se escribe en cada renta</span>
      </div>
      <div className="divide-y divide-gray-50">
        {list.map((l, i) => (
          <div key={l.code} className="flex items-center gap-2 px-4 py-2">
            <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
            <input value={l.label} maxLength={60} disabled={disabled} placeholder="Ej. Aeropuerto LRM"
              onChange={e => { setList(list.map(x => x.code === l.code ? { ...x, label: e.target.value } : x)); touch() }}
              className="flex-1 min-w-0 px-2 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            {canEdit && (
              <>
                <button type="button" onClick={() => move(i, -1)} disabled={pending || i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1" title="Subir">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={pending || i === list.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1" title="Bajar">↓</button>
                <button type="button" onClick={() => { setList(list.filter(x => x.code !== l.code)); touch() }} disabled={pending}
                  className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50">Quitar</button>
              </>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/60">
          <span className="text-xs text-gray-400 w-5">{list.length + 1}.</span>
          <span className="text-sm text-gray-500 flex-1">Otros <span className="text-xs">(descripción libre, siempre disponible)</span></span>
        </div>
      </div>
      {canEdit && (
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending || list.length >= 40}
            onClick={() => { setList([...list, { code: newCode(), label: '' }]); touch() }}
            className="text-[14px] text-blue-600 hover:text-blue-700 font-medium">+ Agregar ubicación</button>
          <button type="button" onClick={save} disabled={pending}
            className="ml-auto px-4 py-2 text-[14px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {pending ? 'Guardando...' : 'Guardar ubicaciones'}
          </button>
          {saved && <span className="text-sm text-green-600">Guardado</span>}
          {error && <span className="text-sm text-red-600 w-full">{error}</span>}
        </div>
      )}
    </div>
  )
}
