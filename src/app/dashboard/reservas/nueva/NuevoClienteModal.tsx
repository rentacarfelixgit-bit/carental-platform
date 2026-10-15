'use client'

// src/app/dashboard/reservas/nueva/NuevoClienteModal.tsx

import { useState, useTransition, useEffect, useRef } from 'react'
import { createClientQuick } from '@/app/dashboard/clientes/actions'
import type { ClientFormState } from '@/app/dashboard/clientes/actions'

interface NewClient {
  id: string; full_name: string; id_number: string
  phone: string | null; email: string | null
  license_number: string | null; license_expiry: string | null
  passport_number: string | null; passport_expiry: string | null
  address: string | null; city: string | null; state: string | null; zip_code: string | null
}

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
  const [serverState, setServerState] = useState<ClientFormState>({})
  const [isPending, startTransition]  = useTransition()
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  // Campos controlados
  const [fullName,       setFullName]       = useState('')
  const [phoneCode,      setPhoneCode]      = useState('+1')
  const [phone,          setPhone]          = useState('')
  const [email,          setEmail]          = useState('')
  const [licenseNumber,  setLicenseNumber]  = useState('')
  const [licenseExpiry,  setLicenseExpiry]  = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [passportExpiry, setPassportExpiry] = useState('')
  const [address,        setAddress]        = useState('')
  const [city,           setCity]           = useState('')
  const [stateField,     setStateField]     = useState('')
  const [zipCode,        setZipCode]        = useState('')

  const firstInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { firstInputRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !isPending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isPending])

  useEffect(() => {
    if (serverState.success && serverState.newClient) {
      onClientCreated(serverState.newClient)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverState.success])

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!fullName.trim())         errs.full_name      = 'El nombre es requerido.'
    if (!phone.trim())            errs.phone          = 'El teléfono es requerido.'
    if (!licenseNumber.trim())    errs.license_number = 'La licencia de conducir es requerida.'
    if (!licenseExpiry)           errs.license_expiry = 'La fecha de vencimiento es requerida.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido.'
    return errs
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setLocalErrors(errs); return }
    setLocalErrors({})

    const fd = new FormData()
    fd.set('full_name',       fullName.trim())
    fd.set('phone_code',      phoneCode)
    fd.set('phone',           phone.trim())
    fd.set('email',           email.trim())
    fd.set('license_number',  licenseNumber.trim())
    fd.set('license_expiry',  licenseExpiry)
    fd.set('passport_number', passportNumber.trim())
    fd.set('passport_expiry', passportExpiry)
    fd.set('address',         address.trim())
    fd.set('city',            city.trim())
    fd.set('state',           stateField.trim())
    fd.set('zip_code',        zipCode.trim())

    startTransition(async () => {
      const result = await createClientQuick(serverState, fd)
      setServerState(result)
    })
  }

  const fe = {
    full_name:      serverState.fieldErrors?.full_name?.[0]      || localErrors.full_name      || '',
    phone:          serverState.fieldErrors?.phone?.[0]          || localErrors.phone          || '',
    email:          serverState.fieldErrors?.email?.[0]          || localErrors.email          || '',
    license_number: serverState.fieldErrors?.license_number?.[0] || localErrors.license_number || '',
    license_expiry: serverState.fieldErrors?.license_expiry?.[0] || localErrors.license_expiry || '',
  }

  const inp = (hasError: boolean) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 placeholder:text-gray-400 disabled:opacity-50 transition-colors ${
      hasError
        ? 'border-red-400 bg-red-50 focus:ring-red-300'
        : 'border-gray-300 focus:ring-blue-500'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !isPending) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto relative">

        {/* Overlay de carga */}
        {isPending && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl gap-3">
            <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">Creando cliente...</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Datos del Cliente</h2>
            <p className="text-xs text-gray-500 mt-0.5">El cliente quedará seleccionado automáticamente.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6">

          {/* Error general */}
          {serverState.error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {serverState.error}
            </div>
          )}

          {/* ── GRID 2 COLUMNAS ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

            {/* ── COLUMNA IZQUIERDA ─────────────────────────────────────── */}

            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setLocalErrors(p => ({ ...p, full_name: '' })) }}
                disabled={isPending}
                maxLength={150}
                placeholder="Juan Pérez García"
                className={inp(!!fe.full_name)}
              />
              {fe.full_name && <FieldError msg={fe.full_name} />}
            </div>

            {/* Licencia + Vencimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Licencia de Conducir <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={e => { setLicenseNumber(e.target.value.toUpperCase()); setLocalErrors(p => ({ ...p, license_number: '' })) }}
                    disabled={isPending}
                    maxLength={30}
                    placeholder="L-12345678"
                    className={`${inp(!!fe.license_number)} uppercase`}
                  />
                  {fe.license_number && <FieldError msg={fe.license_number} />}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Vencimiento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={e => { setLicenseExpiry(e.target.value); setLocalErrors(p => ({ ...p, license_expiry: '' })) }}
                    disabled={isPending}
                    className={inp(!!fe.license_expiry)}
                  />
                  {fe.license_expiry && <FieldError msg={fe.license_expiry} />}
                </div>
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Teléfono / Celular <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={phoneCode}
                  onChange={e => setPhoneCode(e.target.value)}
                  disabled={isPending}
                  className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                  style={{ minWidth: 88 }}
                >
                  {LADAS.map((l, i) => (
                    <option key={i} value={l.code}>{l.flag} {l.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value.replace(/[^0-9\s\-().+]/g, '')); setLocalErrors(p => ({ ...p, phone: '' })) }}
                  disabled={isPending}
                  maxLength={15}
                  placeholder="809 555 0000"
                  className={`flex-1 ${inp(!!fe.phone)}`}
                />
              </div>
              {fe.phone && <FieldError msg={fe.phone} />}
            </div>

            {/* Pasaporte + Vencimiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Pasaporte o Identificación
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={passportNumber}
                  onChange={e => setPassportNumber(e.target.value.toUpperCase())}
                  disabled={isPending}
                  maxLength={30}
                  placeholder="AB1234567"
                  className={`${inp(false)} uppercase`}
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={passportExpiry}
                    onChange={e => setPassportExpiry(e.target.value)}
                    disabled={isPending}
                    className={inp(false)}
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (Opcional)</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setLocalErrors(p => ({ ...p, email: '' })) }}
                disabled={isPending}
                maxLength={150}
                placeholder="cliente@email.com"
                className={inp(!!fe.email)}
              />
              {fe.email && <FieldError msg={fe.email} />}
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                disabled={isPending}
                maxLength={200}
                placeholder="Calle Principal 123"
                className={inp(false)}
              />
            </div>

            {/* Ciudad / Estado / Zip — ocupa toda la fila */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    disabled={isPending}
                    maxLength={100}
                    placeholder="Santo Domingo"
                    className={inp(false)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Estado</label>
                  <input
                    type="text"
                    value={stateField}
                    onChange={e => setStateField(e.target.value)}
                    disabled={isPending}
                    maxLength={100}
                    placeholder="D.N."
                    className={inp(false)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Zip-Code</label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={e => setZipCode(e.target.value)}
                    disabled={isPending}
                    maxLength={20}
                    placeholder="10101"
                    className={inp(false)}
                  />
                </div>
              </div>
            </div>

          </div>{/* fin grid */}

          {/* Acciones */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              Guardar cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {msg}
    </p>
  )
}
