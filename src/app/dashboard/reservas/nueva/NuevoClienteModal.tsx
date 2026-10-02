'use client'

// src/app/dashboard/reservas/nueva/NuevoClienteModal.tsx
// Modal para crear un cliente sin abandonar la página de nueva reserva.

import { useActionState, useEffect, useState } from 'react'
import { createClientQuick } from '@/app/dashboard/clientes/actions'

interface NewClient { id: string; full_name: string; id_number: string }

interface Props {
  onClientCreated: (client: NewClient) => void
  onClose: () => void
}

const LADAS = [
  { code: '+1',  flag: '🇩🇴', label: 'RD  +1' },
  { code: '+1',  flag: '🇺🇸', label: 'US  +1' },
  { code: '+52', flag: '🇲🇽', label: 'MX +52' },
  { code: '+58', flag: '🇻🇪', label: 'VE +58' },
  { code: '+57', flag: '🇨🇴', label: 'CO +57' },
  { code: '+34', flag: '🇪🇸', label: 'ES +34' },
]

export default function NuevoClienteModal({ onClientCreated, onClose }: Props) {
  const [state, action, pending] = useActionState(createClientQuick, {})

  const [fullName,       setFullName]       = useState(state.values?.full_name        ?? '')
  const [phoneCode,      setPhoneCode]      = useState(state.values?.phone_code       ?? '+1')
  const [phone,          setPhone]          = useState(state.values?.phone            ?? '')
  const [email,          setEmail]          = useState(state.values?.email            ?? '')
  const [licenseNumber,  setLicenseNumber]  = useState(state.values?.license_number   ?? '')
  const [licenseExpiry,  setLicenseExpiry]  = useState(state.values?.license_expiry   ?? '')
  const [passportNumber, setPassportNumber] = useState(state.values?.passport_number  ?? '')
  const [notes,          setNotes]          = useState(state.values?.notes            ?? '')

  // Cuando se crea correctamente, notificar al padre
  useEffect(() => {
    if (state.success && state.newClient) {
      onClientCreated(state.newClient)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  function handlePhone(v: string) {
    setPhone(v.replace(/[^0-9\s\-().+]/g, ''))
  }

  const fe = state.fieldErrors ?? {}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nuevo cliente</h2>
            <p className="text-xs text-gray-500 mt-0.5">El cliente quedará seleccionado automáticamente.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form action={action} className="p-6 space-y-5">
          {/* Campos ocultos para enviar el estado controlado */}
          <input type="hidden" name="full_name"       value={fullName} />
          <input type="hidden" name="phone_code"      value={phoneCode} />
          <input type="hidden" name="phone"           value={phone} />
          <input type="hidden" name="email"           value={email} />
          <input type="hidden" name="license_number"  value={licenseNumber} />
          <input type="hidden" name="license_expiry"  value={licenseExpiry} />
          <input type="hidden" name="passport_number" value={passportNumber} />
          <input type="hidden" name="notes"           value={notes} />

          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* Datos personales */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={pending}
                maxLength={150}
                placeholder="Juan Pérez García"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 ${fe.full_name ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {fe.full_name && <p className="mt-1 text-xs text-red-600">{fe.full_name[0]}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
              <div className="flex gap-2">
                <select
                  value={phoneCode}
                  onChange={e => setPhoneCode(e.target.value)}
                  disabled={pending}
                  className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                  style={{ minWidth: 90 }}
                >
                  {LADAS.map((l, i) => (
                    <option key={i} value={l.code}>{l.flag} {l.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => handlePhone(e.target.value)}
                  disabled={pending}
                  maxLength={15}
                  placeholder="809 555 0000"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={pending}
                maxLength={150}
                placeholder="cliente@email.com"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 ${fe.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {fe.email && <p className="mt-1 text-xs text-red-600">{fe.email[0]}</p>}
            </div>
          </div>

          {/* Identificaciones */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Identificaciones</p>
              <p className="text-xs text-gray-400">Ingresa al menos una.</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Licencia de conducir</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Número</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value.toUpperCase())}
                    disabled={pending}
                    maxLength={30}
                    placeholder="L-12345678"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 uppercase bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={e => setLicenseExpiry(e.target.value)}
                    disabled={pending}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Pasaporte</p>
              <input
                type="text"
                value={passportNumber}
                onChange={e => setPassportNumber(e.target.value.toUpperCase())}
                disabled={pending}
                maxLength={30}
                placeholder="AB1234567"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 uppercase bg-white"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              disabled={pending}
              maxLength={2000}
              placeholder="Observaciones relevantes..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {pending ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </>
              ) : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
