'use client'

// src/app/dashboard/clientes/ClientForm.tsx
// Formulario reutilizable para crear y editar clientes

import Link from 'next/link'
import type { ClientFormState } from './actions'

interface Client {
  full_name?: string
  id_type?: string
  id_number?: string
  phone?: string | null
  email?: string | null
  license_number?: string | null
  license_expiry?: string | null
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

export default function ClientForm({ action, state, pending, client, title, submitLabel }: Props) {
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

      <form action={action} className="space-y-6">
        {state.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}

        {/* Datos personales */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Datos personales</h2>

          <Field
            label="Nombre completo *"
            name="full_name"
            defaultValue={client?.full_name}
            error={state.fieldErrors?.full_name?.[0]}
            disabled={pending}
            placeholder="Juan Pérez García"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de ID *</label>
              <select
                name="id_type"
                defaultValue={client?.id_type ?? 'license'}
                disabled={pending}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              >
                <option value="license">Licencia de conducir</option>
                <option value="passport">Pasaporte</option>
              </select>
              {state.fieldErrors?.id_type && (
                <p className="mt-1 text-xs text-red-600">{state.fieldErrors.id_type[0]}</p>
              )}
            </div>
            <Field
              label="Número de ID *"
              name="id_number"
              defaultValue={client?.id_number}
              error={state.fieldErrors?.id_number?.[0]}
              disabled={pending}
              placeholder="L1234567"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Teléfono" name="phone" defaultValue={client?.phone ?? ''} disabled={pending} placeholder="+52 555 000 0000" />
            <Field label="Email" name="email" type="email" defaultValue={client?.email ?? ''} error={state.fieldErrors?.email?.[0]} disabled={pending} placeholder="cliente@email.com" />
          </div>
        </div>

        {/* Licencia */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Licencia de conducir</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número de licencia" name="license_number" defaultValue={client?.license_number ?? ''} disabled={pending} placeholder="L-12345678" />
            <Field label="Vencimiento" name="license_expiry" type="date" defaultValue={client?.license_expiry?.split('T')[0] ?? ''} disabled={pending} />
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={client?.notes ?? ''}
            disabled={pending}
            placeholder="Observaciones relevantes sobre el cliente..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
          />
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Link href="/dashboard/clientes" className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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

function Field({
  label, name, type = 'text', defaultValue, error, disabled, placeholder,
}: {
  label: string; name: string; type?: string; defaultValue?: string
  error?: string; disabled?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        id={name} name={name} type={type} defaultValue={defaultValue}
        disabled={disabled} placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
