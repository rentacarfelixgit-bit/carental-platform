'use client'

// src/app/dashboard/reservas/nueva/NuevaReservaForm.tsx
// Form reactivo: al cambiar fechas filtra vehículos disponibles,
// al cambiar cliente avisa si está en lista negra.

import { useState, useTransition, useActionState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createReservation, getAvailableVehicles } from '../actions'
import BlacklistWarning from '@/components/dashboard/BlacklistWarning'
import Link from 'next/link'

interface Client { id: string; full_name: string; id_number: string }
interface Vehicle { id: string; plates: string; brand: string; model: string; year: number; color: string }

interface Props {
  clients: Client[]
}

const EXTRAS = [
  { value: 'gps',          label: 'GPS' },
  { value: 'baby_seat',    label: 'Silla para bebé' },
  { value: 'extra_driver', label: 'Conductor adicional' },
  { value: 'custom',       label: 'Extra personalizado' },
]

export default function NuevaReservaForm({ clients }: Props) {
  const [state, action, pending] = useActionState(createReservation, {})

  const [selectedClientId, setSelectedClientId] = useState('')
  const [blacklistStatus, setBlacklistStatus]   = useState<{ blacklisted: boolean; reason?: string; addedAt?: string } | null>(null)
  const [checkingBlacklist, setCheckingBlacklist] = useTransition()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[] | null>(null)
  const [loadingVehicles, setLoadingVehicles] = useTransition()

  const [selectedExtras, setSelectedExtras] = useState<string[]>([])

  // Al cambiar cliente → verificar lista negra
  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId)
    setBlacklistStatus(null)
    if (!clientId) return

    setCheckingBlacklist(async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('client_blacklist')
        .select('id, reason, added_at')
        .eq('client_id', clientId)
        .eq('active', true)
        .maybeSingle()

      setBlacklistStatus(data
        ? { blacklisted: true, reason: data.reason, addedAt: data.added_at }
        : { blacklisted: false }
      )
    })
  }

  // Al cambiar fechas → cargar vehículos disponibles
  function handleDateChange(newStart: string, newEnd: string) {
    if (newStart) setStartDate(newStart)
    if (newEnd)   setEndDate(newEnd)

    // Usar || en lugar de ?? para que '' (string vacío) caiga al valor del estado
    const s = newStart || startDate
    const e = newEnd   || endDate

    if (!s || !e || new Date(e) <= new Date(s)) {
      setAvailableVehicles(null)
      return
    }

    setLoadingVehicles(async () => {
      const vehicles = await getAvailableVehicles(s, e)
      setAvailableVehicles(vehicles as Vehicle[])
    })
  }

  function toggleExtra(value: string) {
    setSelectedExtras(prev =>
      prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]
    )
  }

  const isBlacklisted = blacklistStatus?.blacklisted === true

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/reservas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Reservas
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nueva reserva</h1>
      </div>

      <form action={action} className="space-y-6">
        {state.error && !state.blacklisted && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{state.error}</div>
        )}

        {/* Lista negra — bloquea el formulario */}
        {(isBlacklisted || state.blacklisted) && (
          <BlacklistWarning
            reason={(blacklistStatus?.reason ?? state.blacklistReason) || 'Cliente en lista negra'}
            addedAt={blacklistStatus?.addedAt}
            blocking
          />
        )}

        {/* Cliente */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Cliente</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Selecciona un cliente *</label>
            <select
              name="client_id"
              value={selectedClientId}
              onChange={e => handleClientChange(e.target.value)}
              disabled={pending}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
            >
              <option value="">— Elige un cliente —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name} · {c.id_number}</option>
              ))}
            </select>
            {checkingBlacklist && <p className="mt-1 text-xs text-gray-400">Verificando lista negra...</p>}
            {state.fieldErrors?.client_id && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.client_id[0]}</p>}
          </div>
        </div>

        {/* Fechas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Periodo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha y hora de salida *</label>
              <input
                type="datetime-local"
                name="start_date"
                value={startDate}
                onChange={e => handleDateChange(e.target.value, '')}
                disabled={pending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {state.fieldErrors?.start_date && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.start_date[0]}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha y hora de regreso *</label>
              <input
                type="datetime-local"
                name="end_date"
                value={endDate}
                onChange={e => handleDateChange('', e.target.value)}
                disabled={pending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {state.fieldErrors?.end_date && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.end_date[0]}</p>}
            </div>
          </div>
          {startDate && endDate && new Date(endDate) > new Date(startDate) && (
            <p className="text-xs text-gray-500">
              Duración:{' '}
              {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} día(s)
            </p>
          )}
        </div>

        {/* Vehículo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Vehículo</h2>
          {!startDate || !endDate ? (
            <p className="text-sm text-gray-400">Selecciona las fechas para ver los vehículos disponibles.</p>
          ) : loadingVehicles ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              Buscando vehículos disponibles...
            </div>
          ) : availableVehicles !== null ? (
            availableVehicles.length === 0 ? (
              <p className="text-sm text-orange-600">No hay vehículos disponibles para esas fechas.</p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vehículo disponible * <span className="text-gray-400 font-normal">({availableVehicles.length} opción{availableVehicles.length !== 1 ? 'es' : ''})</span>
                </label>
                <select
                  name="vehicle_id"
                  disabled={pending}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                  <option value="">— Elige un vehículo —</option>
                  {availableVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} {v.year} · {v.plates} · {v.color}
                    </option>
                  ))}
                </select>
                {state.fieldErrors?.vehicle_id && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.vehicle_id[0]}</p>}
              </div>
            )
          ) : null}
        </div>

        {/* Extras */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Extras (opcional)</h2>
          <div className="grid grid-cols-2 gap-2">
            {EXTRAS.map(e => (
              <label key={e.value} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  name="extras"
                  value={e.value}
                  checked={selectedExtras.includes(e.value)}
                  onChange={() => toggleExtra(e.value)}
                  disabled={pending}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{e.label}</span>
              </label>
            ))}
          </div>
          {selectedExtras.includes('custom') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción del extra personalizado</label>
              <input
                type="text"
                name="custom_extra"
                disabled={pending}
                placeholder="Ej. Portabicicletas, toldo, etc."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
          <textarea
            name="notes"
            rows={3}
            disabled={pending}
            placeholder="Instrucciones especiales, acuerdos, etc."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
          />
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Link href="/dashboard/reservas" className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pending || isBlacklisted || !availableVehicles || availableVehicles.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </>
            ) : 'Crear reserva'}
          </button>
        </div>
      </form>
    </div>
  )
}
