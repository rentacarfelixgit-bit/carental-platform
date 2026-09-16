'use client'

import { useRef, useState, useTransition } from 'react'
import { saveBusinessData } from './actions'

interface Props {
  settings: Record<string, string>
  tenantName: string
  timezone: string
}

export default function BusinessForm({ settings, tenantName, timezone }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData(formRef.current!)
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await saveBusinessData(fd)
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  const field = (label: string, name: string, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={settings[name] ?? ''}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Nombre de la empresa', 'company_name', tenantName || 'Ej: Felix Castillo Car Rental')}
        {field('RNC / Registro fiscal', 'rnc', 'Ej: 1-23-45678-9')}
      </div>
      {field('Dirección', 'address', 'Av. Víctor Manuel Espaillat...')}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Ciudad / Sucursal', 'city', 'Ej: Licey al Medio, Santiago')}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Zona horaria</label>
          <input
            type="text"
            value={timezone}
            readOnly
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Teléfono principal', 'phone', '829-864-3074')}
        {field('Teléfono secundario', 'phone_2', 'Opcional')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Email principal', 'email', 'contacto@empresa.com', 'email')}
        {field('Email secundario', 'email_2', 'Opcional', 'email')}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Guardando...' : 'Guardar datos'}
        </button>
        {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  )
}
