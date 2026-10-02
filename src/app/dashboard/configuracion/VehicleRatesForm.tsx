'use client'

import { useState, useTransition, useMemo } from 'react'
import { saveVehicleRate, saveAllVehicleRates } from './actions'

const PAGE_SIZE = 10

interface Vehicle {
  id: string
  brand: string
  model: string
  year: number
  plates: string
  daily_rate: number | null
}

export default function VehicleRatesForm({ vehicles }: { vehicles: Vehicle[] }) {
  // Estado de tarifas (todas, incluso las de otras páginas)
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(vehicles.map(v => [v.id, v.daily_rate?.toString() ?? '']))
  )
  // IDs modificados pendientes de guardar
  const [dirty, setDirty] = useState<Set<string>>(new Set())

  const [savingOne, setSavingOne]   = useState<string | null>(null)
  const [savedOne, setSavedOne]     = useState<string | null>(null)
  const [savingAll, startSaveAll]   = useTransition()
  const [allSaved, setAllSaved]     = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  // Filtro y paginación
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(v =>
      `${v.brand} ${v.model} ${v.year} ${v.plates}`.toLowerCase().includes(q)
    )
  }, [vehicles, search])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const pageItems   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const dirtyCount  = dirty.size

  function handleChange(vehicleId: string, value: string) {
    setRates(r => ({ ...r, [vehicleId]: value }))
    setDirty(d => new Set(d).add(vehicleId))
    setSavedOne(null)
    setAllSaved(false)
    setGlobalError('')
  }

  // Guardar uno solo
  async function handleSaveOne(vehicleId: string) {
    const val = parseFloat(rates[vehicleId] ?? '')
    if (isNaN(val) || val < 0) {
      setErrors(e => ({ ...e, [vehicleId]: 'Valor inválido' }))
      return
    }
    setErrors(e => { const n = { ...e }; delete n[vehicleId]; return n })
    setSavingOne(vehicleId)
    setSavedOne(null)
    const result = await saveVehicleRate(vehicleId, val)
    setSavingOne(null)
    if (result?.error) {
      setErrors(e => ({ ...e, [vehicleId]: result.error! }))
    } else {
      setSavedOne(vehicleId)
      setDirty(d => { const n = new Set(d); n.delete(vehicleId); return n })
    }
  }

  // Guardar todos los modificados
  function handleSaveAll() {
    const entries: { vehicleId: string; dailyRate: number }[] = []
    const newErrors: Record<string, string> = {}

    for (const id of dirty) {
      const val = parseFloat(rates[id] ?? '')
      if (isNaN(val) || val < 0) {
        newErrors[id] = 'Valor inválido'
      } else {
        entries.push({ vehicleId: id, dailyRate: val })
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(e => ({ ...e, ...newErrors }))
      return
    }

    setGlobalError('')
    setAllSaved(false)
    startSaveAll(async () => {
      const result = await saveAllVehicleRates(entries)
      if (result?.error) {
        setGlobalError(result.error)
      } else {
        setAllSaved(true)
        setDirty(new Set())
        setSavedOne(null)
      }
    })
  }

  if (vehicles.length === 0) {
    return <p className="text-sm text-gray-400">No hay vehículos activos.</p>
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas: filtro + "Guardar todos" */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por vehículo o placas..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              {dirtyCount} cambio{dirtyCount !== 1 ? 's' : ''} sin guardar
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={dirtyCount === 0 || savingAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {savingAll ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Guardando...
              </>
            ) : 'Guardar todos'}
          </button>
          {allSaved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Todo guardado
            </span>
          )}
        </div>
      </div>

      {globalError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{globalError}</p>
      )}

      {/* Lista de vehículos — página actual */}
      <div className="space-y-2">
        {pageItems.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Sin resultados para "{search}"</p>
        ) : pageItems.map(v => {
          const isDirty = dirty.has(v.id)
          return (
            <div
              key={v.id}
              className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-colors ${
                isDirty ? 'border-amber-300' : 'border-gray-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {v.brand} {v.model}{' '}
                  <span className="text-gray-400 font-normal">{v.year}</span>
                  {isDirty && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" title="Cambio pendiente" />
                  )}
                </p>
                <p className="text-xs font-mono text-gray-400">{v.plates}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500">RD$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rates[v.id]}
                  onChange={e => handleChange(v.id, e.target.value)}
                  placeholder="0.00"
                  className={`w-24 px-2 py-1.5 text-sm border rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors[v.id] ? 'border-red-400' : isDirty ? 'border-amber-300' : 'border-gray-300'
                  }`}
                />
                <span className="text-xs text-gray-500">/ día</span>
                <button
                  onClick={() => handleSaveOne(v.id)}
                  disabled={savingOne === v.id || savingAll}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {savingOne === v.id ? '...' : 'Guardar'}
                </button>
                {savedOne === v.id && (
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>

              {errors[v.id] && (
                <p className="text-xs text-red-500 w-full mt-1">{errors[v.id]}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} vehículos
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              ← Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                  p === safePage
                    ? 'bg-gray-900 border-gray-900 text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
