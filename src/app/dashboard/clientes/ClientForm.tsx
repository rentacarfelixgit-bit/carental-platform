'use client'

// src/app/dashboard/clientes/ClientForm.tsx
// Formulario controlado — preserva datos en error, dual ID, lada, maxLength

import Link from 'next/link'
import { useState } from 'react'
import type { ClientFormState } from './actions'

// Ladas frecuentes — República Dominicana como default
const LADAS = [
  { code: '+1',  flag: '🇩🇴', label: 'RD  +1' },
  { code: '+1',  flag: '🇺🇸', label: 'US  +1' },
  { code: '+1',  flag: '🇵🇷', label: 'PR  +1' },
  { code: '+52', flag: '🇲🇽', label: 'MX +52' },
  { code: '+58', flag: '🇻🇪', label: 'VE +58' },
  { code: '+57', flag: '🇨🇴', label: 'CO +57' },
  { code: '+34', flag: '🇪🇸', label: 'ES +34' },
]

interface Client {
  full_name?: string
  phone?: string | null
  email?: string | null
  license_number?: string | null
  license_expiry?: string | null
  passport_number?: string | null
  notes?: string | null
}

interface Props {
  action: (payload: FormData) => void
  state: ClientFormState
  pending: boolean
  client?: Client
  title: string
  submitLabel: string
}

function parsePhone(raw: string | null | undefined): { code: string; number: string } {
  if (!raw) return { code: '+1', number: '' }
  for (const l of LADAS) {
    if (raw.startsWith(l.code)) return { code: l.code, number: raw.slice(l.code.length).trim() }
  }
  return { code: '+1', number: raw }
}

export default function ClientForm({ action, state, pending, client, title, submitLabel }: Props) {
  const parsed = parsePhone(client?.phone)

  // Estado controlado — preserva valores al recibir errores del servidor
  const [fullName,        setFullName]        = useState(state.values?.full_name        ?? client?.full_name        ?? '')
  const [phoneCode,       setPhoneCode]       = useState(state.values?.phone_code       ?? parsed.code)
  const [phone,           setPhone]           = useState(state.values?.phone            ?? parsed.number)
  const [email,           setEmail]           = useState(state.values?.email            ?? client?.email            ?? '')
  const [licenseNumber,   setLicenseNumber]   = useState(state.values?.license_number   ?? client?.license_number   ?? '')
  const [licenseExpiry,   setLicenseExpiry]   = useState(state.values?.license_expiry   ?? client?.license_expiry?.split('T')[0] ?? '')
  const [passportNumber,  setPassportNumber]  = useState(state.values?.passport_number  ?? client?.passport_number  ?? '')
  const [notes,           setNotes]           = useState(state.values?.notes            ?? client?.notes            ?? '')

  // Filtrar input de teléfono: solo dígitos, guiones y espacios
  function handlePhone(v: string) {
    setPhone(v.replace(/[^0-9\s\-().+]/g, ''))
  }

  const fe = state.fieldErrors ?? {}

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/clientes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Clientes
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      <form action={action} className="space-y-5">
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
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Datos personales</h2>

          {/* Nombre completo */}
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

          {/* Teléfono con lada */}
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
              onChange={e => setEmail(e.target.value)}
              disabled={pending}
              maxLength={150}
              placeholder="cliente@email.com"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 ${fe.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
            />
            {fe.email && <p className="mt-1 text-xs text-red-600">{fe.email[0]}</p>}
          </div>
        </div>

        {/* Identificaciones — al menos una obligatoria */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-sm font-medium text-gray-700">Identificaciones</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ingresa al menos una — puedes registrar ambas.</p>
          </div>

          {/* Licencia de conducir */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Licencia de conducir</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Número de licencia</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={e => setLicenseNumber(e.target.value.toUpperCase())}
                  disabled={pending}
                  maxLength={30}
                  placeholder="L-12345678"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Vencimiento</label>
                <input
                  type="date"
                  value={licenseExpiry}
                  onChange={e => setLicenseExpiry(e.target.value)}
                  disabled={pending}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Pasaporte */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pasaporte</p>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Número de pasaporte</label>
              <input
                type="text"
                value={passportNumber}
                onChange={e => setPassportNumber(e.target.value.toUpperCase())}
                disabled={pending}
                maxLength={30}
                placeholder="AB1234567"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 uppercase"
              />
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            disabled={pending}
            maxLength={2000}
            placeholder="Observaciones relevantes sobre el cliente..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{notes.length}/2000</p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Link
            href="/dashboard/clientes"
            className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
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
            ) : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
