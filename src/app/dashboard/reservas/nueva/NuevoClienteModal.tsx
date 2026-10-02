'use client'

// src/app/dashboard/reservas/nueva/NuevoClienteModal.tsx
// Modal para crear un cliente sin abandonar la página de nueva reserva.

import { useActionState, useEffect, useRef, useState } from 'react'
import { createClientQuick } from '@/app/dashboard/clientes/actions'

interface NewClient { id: string; full_name: string; id_number: string }

interface Props {
  onClientCreated: (client: NewClient) => void
  onClose: () => void
}

const LADAS = [
  { code: '+1',  flag: '🇩🇴', label: 'DO +1' },
  { code: '+1',  flag: '🇺🇸', label: 'US +1' },
  { code: '+52', flag: '🇲🇽', label: 'MX +52' },
  { code: '+58', flag: '🇻🇪', label: 'VE +58' },
  { code: '+57', flag: '🇨🇴', label: 'CO +57' },
  { code: '+34', flag: '🇪🇸', label: 'ES +34' },
]

export default function NuevoClienteModal({ onClientCreated, onClose }: Props) {
  const [state, action, pending] = useActionState(createClientQuick, {})

  // Campos controlados
  const [fullName,       setFullName]       = useState(state.values?.full_name       ?? '')
  const [phoneCode,      setPhoneCode]      = useState(state.values?.phone_code      ?? '+1')
  const [phone,          setPhone]          = useState(state.values?.phone           ?? '')
  const [email,          setEmail]          = useState(state.values?.email           ?? '')
  const [licenseNumber,  setLicenseNumber]  = useState(state.values?.license_number  ?? '')
  const [licenseExpiry,  setLicenseExpiry]  = useState(state.values?.license_expiry  ?? '')
  const [passportNumber, setPassportNumber] = useState(state.values?.passport_number ?? '')
  const [notes,          setNotes]          = useState(state.values?.notes           ?? '')

  // Errores client-side
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Cuando se crea correctamente, notificar al padre
  useEffect(() => {
    if (state.success && state.newClient) {
      onClientCreated(state.newClient)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  // Validación client-side antes de enviar
  function handlePreSubmit(e: React.FormEvent<HTMLFormElement>) {
    const errs: Record<string, string> = {}

    if (!fullName.trim()) {
      errs.full_name = 'El nombre es requerido.'
    }
    if (!licenseNumber.trim() && !passportNumber.trim()) {
      errs.identifications = 'Ingresa al menos una identificación (licencia o pasaporte).'
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'El formato del email no es válido.'
    }

    if (Object.keys(errs).length > 0) {
      e.preventDefault()
      setLocalErrors(errs)
      return
    }
    setLocalErrors({})
  }

  function handlePhone(v: string) {
    setPhone(v.replace(/[^0-9\s\-().+]/g, ''))
  }

  // Merge server + client errors (server errors take precedence when present)
  const sfe = state.fieldErrors ?? {}
  const fe = {
    full_name:       sfe.full_name?.[0]       || localErrors.full_name,
    email:           sfe.email?.[0]           || localErrors.email,
    identifications: localErrors.identifications,
  }

  // Errores del servidor en el bloque de identifications
  const idServerError = sfe.license_number?.[0] || sfe.passport_number?.[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !pending) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">

        {/* ── Overlay de carga ─────────────────────────────────────────────── */}
        {pending && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl">
            <svg className="animate-spin w-8 h-8 text-blue-600 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Creando cliente...</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-[1]">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nuevo cliente</h2>
            <p className="text-xs text-gray-500 mt-0.5">El cliente quedará seleccionado automáticamente.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form action={action} onSubmit={handlePreSubmit} className="p-6 space-y-5">
          {/* Campos ocultos para enviar el estado controlado */}
          <input type="hidden" name="full_name"       value={fullName} />
          <input type="hidden" name="phone_code"      value={phoneCode} />
          <input type="hidden" name="phone"           value={phone} />
          <input type="hidden" name="email"           value={email} />
          <input type="hidden" name="license_number"  value={licenseNumber} />
          <input type="hidden" name="license_expiry"  value={licenseExpiry} />
          <input type="hidden" name="passport_number" value={passportNumber} />
          <input type="hidden" name="notes"           value={notes} />

          {/* Error general del servidor */}
          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {state.error}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setLocalErrors(p => ({ ...p, full_name: '' })) }}
              disabled={pending}
              maxLength={150}
              placeholder="Juan Pérez García"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 transition-colors ${
                fe.full_name ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-300'
              }`}
            />
            {fe.full_name && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {fe.full_name}
              </p>
            )}
          </div>

          {/* Teléfono */}
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

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setLocalErrors(p => ({ ...p, email: '' })) }}
              disabled={pending}
              maxLength={150}
              placeholder="cliente@email.com"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 transition-colors ${
                fe.email ? 'border-red-400 bg-red-50 focus:ring-red-400' : 'border-gray-300'
              }`}
            />
            {fe.email && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {fe.email}
              </p>
            )}
          </div>

          {/* Identificaciones */}
          <div className={`border rounded-xl p-4 space-y-4 transition-colors ${
            fe.identifications || idServerError
              ? 'border-red-300 bg-red-50'
              : 'border-gray-100 bg-gray-50'
          }`}>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                Identificaciones <span className="text-red-500">*</span>
              </p>
              <p className="text-xs text-gray-400">Ingresa al menos una.</p>
            </div>

            {/* Error de identifications */}
            {(fe.identifications || idServerError) && (
              <p className="text-xs text-red-600 flex items-center gap-1 -mt-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {fe.identifications || idServerError}
              </p>
            )}

            {/* Licencia */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Licencia de conducir</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Número</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => {
                      setLicenseNumber(e.target.value.toUpperCase())
                      setLocalErrors(p => ({ ...p, identifications: '' }))
                    }}
                    disabled={pending}
                    maxLength={30}
                    placeholder="L-12345678"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 uppercase bg-white transition-colors ${
                      (fe.identifications || idServerError) && !licenseNumber ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vencimiento</label>
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

            {/* Pasaporte */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Pasaporte</p>
              <input
                type="text"
                value={passportNumber}
                onChange={e => {
                  setPassportNumber(e.target.value.toUpperCase())
                  setLocalErrors(p => ({ ...p, identifications: '' }))
                }}
                disabled={pending}
                maxLength={30}
                placeholder="AB1234567"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 uppercase bg-white transition-colors ${
                  (fe.identifications || idServerError) && !passportNumber ? 'border-red-300' : 'border-gray-300'
                }`}
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
              Guardar cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
