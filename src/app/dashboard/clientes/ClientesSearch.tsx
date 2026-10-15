'use client'

// Formulario de búsqueda de clientes — Client Component
// Separado de page.tsx para poder usar onSubmit sin romper el Server Component

import Link from 'next/link'
import { useRef } from 'react'

interface Props {
  defaultValue?: string
  /** Orden actual de la tabla, para conservarlo al buscar */
  sort?: { key: string; dir: string } | null
}

export default function ClientesSearch({ defaultValue = '', sort = null }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleSubmit() {
    if (btnRef.current) {
      btnRef.current.disabled = true
      btnRef.current.textContent = 'Buscando…'
    }
  }

  return (
    <form method="GET" className="flex gap-3 mb-5" onSubmit={handleSubmit}>
      {sort && <input type="hidden" name="orden" value={sort.key} />}
      {sort && <input type="hidden" name="dir" value={sort.dir} />}
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar por nombre, ID, teléfono o email..."
        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        maxLength={100}
      />
      <button
        ref={btnRef}
        type="submit"
        className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
      >
        Buscar
      </button>
      {defaultValue && (
        <Link href="/dashboard/clientes" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Limpiar
        </Link>
      )}
    </form>
  )
}
