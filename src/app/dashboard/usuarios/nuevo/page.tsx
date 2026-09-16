'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { createUser, type CreateUserState } from '../actions'

const initialState: CreateUserState = {}

export default function NuevoUsuarioPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createUser, initialState)

  useEffect(() => {
    if (state.success) {
      router.push('/dashboard/usuarios')
    }
  }, [state.success, router])

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/usuarios"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Usuarios
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo usuario</h1>
        <p className="text-sm text-gray-500 mt-1">
          El usuario podrá iniciar sesión de inmediato con las credenciales que definas.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <form action={action} className="space-y-5">
          {state.error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          <Field
            label="Nombre completo"
            name="full_name"
            type="text"
            placeholder="Juan Pérez"
            autoComplete="name"
            error={state.fieldErrors?.full_name?.[0]}
            disabled={pending}
          />

          <Field
            label="Correo electrónico"
            name="email"
            type="email"
            placeholder="juan@empresa.com"
            autoComplete="email"
            error={state.fieldErrors?.email?.[0]}
            disabled={pending}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Rol
            </label>
            <select
              name="role"
              disabled={pending}
              defaultValue="operator"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:opacity-50"
            >
              <option value="operator">Operador — acceso a inspecciones y reservas</option>
              <option value="admin">Administrador — acceso completo al tenant</option>
            </select>
            {state.fieldErrors?.role?.[0] && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.role[0]}</p>
            )}
          </div>

          <Field
            label="Contraseña temporal"
            name="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            error={state.fieldErrors?.password?.[0]}
            disabled={pending}
            hint="El usuario puede cambiarla después desde su perfil."
          />

          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard/usuarios"
              className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando...
                </>
              ) : (
                'Crear usuario'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
  error,
  disabled,
  hint,
}: {
  label: string
  name: string
  type: string
  placeholder: string
  autoComplete?: string
  error?: string
  disabled?: boolean
  hint?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'

  return (
    <div>
      <label htmlFor={name} className="block font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 disabled:opacity-50 ${
            isPassword ? 'pr-10' : ''
          } ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={disabled}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
