'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import type { VehicleFormState } from './actions'

interface Vehicle {
  plates?: string
  brand?: string
  model?: string
  year?: number
  color?: string
  vin?: string | null
  insurance_policy?: string | null
  insurance_expiry?: string | null
  permit_expiry?: string | null
  notes?: string | null
  daily_rate?: number | null
}

interface Props {
  action: (payload: FormData) => void
  state: VehicleFormState
  pending: boolean
  vehicle?: Vehicle
  title: string
  submitLabel: string
  /** undefined = create mode (all users can set); true = admin editing; false = operator editing (read-only) */
  isAdmin?: boolean
}

const requiredFields = ['brand', 'model', 'color', 'plates'] as const

export default function VehicleForm({ action, state, pending, vehicle, title, submitLabel, isAdmin }: Props) {
  // isAdmin === undefined means create mode (all users can set the rate)
  const canEditRate = isAdmin !== false
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const [clearedServerErrors, setClearedServerErrors] = useState<Record<string, boolean>>({})

  function getFieldError(name: string) {
    return clientErrors[name] ?? (clearedServerErrors[name] ? undefined : state.fieldErrors?.[name]?.[0])
  }

  function isFieldValid(name: string, value: string) {
    if (requiredFields.some((field) => field === name)) return Boolean(value.trim())
    if (name !== 'year') return true

    const year = Number(value)
    const currentYear = new Date().getFullYear()
    return Number.isInteger(year) && year >= 1990 && year <= currentYear + 1
  }

  function clearErrorWhenValid(event: FormEvent<HTMLFormElement>) {
    const input = event.target as HTMLInputElement
    if (!input.name || !isFieldValid(input.name, input.value)) return

    setClientErrors((errors) => {
      if (!errors[input.name]) return errors
      const remainingErrors = { ...errors }
      delete remainingErrors[input.name]
      return remainingErrors
    })
    setClearedServerErrors((errors) => ({ ...errors, [input.name]: true }))
  }

  function validateForm(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget)
    const errors: Record<string, string> = {}

    for (const field of requiredFields) {
      if (!String(formData.get(field) ?? '').trim()) {
        errors[field] = 'Este campo es obligatorio.'
      }
    }

    // Validación de tarifa diaria (obligatoria en crear; en editar solo para admin)
    if (canEditRate) {
      const rateRaw = String(formData.get('daily_rate') ?? '').trim()
      if (!rateRaw) {
        errors.daily_rate = 'La tarifa diaria es obligatoria.'
      } else if (isNaN(Number(rateRaw)) || Number(rateRaw) <= 0) {
        errors.daily_rate = 'Ingresa un valor mayor a 0.'
      }
    }

    // Validación de placas
    const plates = String(formData.get('plates') ?? '').trim()
    if (plates && plates.length < 5) {
      errors.plates = 'Las placas deben tener al menos 5 caracteres.'
    } else if (plates && !/^[A-Za-z0-9\-\*]+$/.test(plates)) {
      errors.plates = 'Solo se permiten letras, números, guion (-) y asterisco (*).'
    }

    const year = Number(formData.get('year'))
    const currentYear = new Date().getFullYear()
    if (!formData.get('year')) {
      errors.year = 'El año es obligatorio.'
    } else if (!Number.isInteger(year)) {
      errors.year = 'Ingresa un año válido.'
    } else if (year < 1990) {
      errors.year = 'El año debe ser 1990 o posterior.'
    } else if (year > currentYear + 1) {
      errors.year = `El año no puede ser mayor a ${currentYear + 1}.`
    }

    setClientErrors(errors)
    if (Object.keys(errors).length > 0) event.preventDefault()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/flota" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Flota
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      <form action={action} onSubmit={validateForm} onInput={clearErrorWhenValid} noValidate className="space-y-6">
        {state.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {state.error}
          </div>
        )}

        {/* Datos básicos */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Datos del vehículo</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Marca *" name="brand" defaultValue={state.values?.brand ?? vehicle?.brand} error={getFieldError('brand')} disabled={pending} placeholder="Toyota" maxLength={100} required />
            <Field label="Modelo *" name="model" defaultValue={state.values?.model ?? vehicle?.model} error={getFieldError('model')} disabled={pending} placeholder="Corolla" maxLength={100} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Año *" name="year" type="number" defaultValue={state.values?.year ?? vehicle?.year?.toString()} error={getFieldError('year')} disabled={pending} placeholder="2022" min={1990} max={new Date().getFullYear() + 1} required />
            <Field label="Color *" name="color" defaultValue={state.values?.color ?? vehicle?.color} error={getFieldError('color')} disabled={pending} placeholder="Blanco" maxLength={50} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Placas *" name="plates" defaultValue={state.values?.plates ?? vehicle?.plates} error={getFieldError('plates')} disabled={pending} placeholder="ABC-1234" className="uppercase" maxLength={20} required
              onInput={(e: React.FormEvent<HTMLInputElement>) => {
                const input = e.currentTarget
                const clean = input.value.replace(/[^A-Za-z0-9\-\*]/g, '').toUpperCase()
                if (clean !== input.value) input.value = clean
              }}
            />
            <Field label="VIN (opcional)" name="vin" defaultValue={state.values?.vin ?? vehicle?.vin ?? ''} disabled={pending} placeholder="1HGBH41JXMN109186" maxLength={17} />
          </div>
        </div>

        {/* Tarifa */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Tarifa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canEditRate ? (
              <Field
                label="Tarifa diaria (RD$) *"
                name="daily_rate"
                type="number"
                defaultValue={state.values?.daily_rate ?? vehicle?.daily_rate?.toString() ?? ''}
                error={getFieldError('daily_rate')}
                disabled={pending}
                placeholder="0.00"
                min={0.01}
                step={0.01}
                required
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tarifa diaria
                </label>
                <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 flex items-center gap-1">
                  <span className="text-gray-400 text-xs">RD$</span>
                  {vehicle?.daily_rate != null
                    ? Number(vehicle.daily_rate).toLocaleString('es-DO', { minimumFractionDigits: 2 })
                    : '—'}
                </div>
                <p className="mt-1 text-xs text-gray-400">Solo los administradores pueden modificar la tarifa.</p>
              </div>
            )}
          </div>
        </div>

        {/* Documentos */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">Documentos y seguros</h2>

          <Field label="Póliza de seguro" name="insurance_policy" defaultValue={state.values?.insurance_policy ?? vehicle?.insurance_policy ?? ''} disabled={pending} placeholder="POL-123456" maxLength={100} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vencimiento seguro" name="insurance_expiry" type="date" defaultValue={state.values?.insurance_expiry ?? vehicle?.insurance_expiry?.split('T')[0] ?? ''} disabled={pending} />
            <Field label="Vencimiento permiso" name="permit_expiry" type="date" defaultValue={state.values?.permit_expiry ?? vehicle?.permit_expiry?.split('T')[0] ?? ''} disabled={pending} />
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas internas</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={state.values?.notes ?? vehicle?.notes ?? ''}
            disabled={pending}
            maxLength={2000}
            placeholder="Observaciones relevantes sobre el vehículo..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
          />
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Link href="/dashboard/flota" className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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
  label, name, type = 'text', defaultValue, error, disabled, placeholder, className = '', required, min, max, maxLength, step, onInput
}: {
  label: string; name: string; type?: string; defaultValue?: string
  error?: string; disabled?: boolean; placeholder?: string; className?: string
  required?: boolean; min?: number; max?: number; maxLength?: number; step?: number
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        id={name} name={name} type={type} defaultValue={defaultValue}
        disabled={disabled} placeholder={placeholder} required={required} min={min} max={max} maxLength={maxLength} step={step}
        onInput={onInput}
        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'} ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
