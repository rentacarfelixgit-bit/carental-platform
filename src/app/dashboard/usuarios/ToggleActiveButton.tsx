'use client'

import { useState, useTransition } from 'react'
import { toggleUserActive } from './actions'

export default function ToggleActiveButton({
  userId,
  active,
}: {
  userId: string
  active: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleClick() {
    setError('')
    startTransition(async () => {
      const res = await toggleUserActive(userId, !active)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <span className="relative inline-flex">
      <button
        onClick={handleClick}
        disabled={pending}
        title={active ? 'Quitar el acceso (no podrá iniciar sesión)' : 'Devolver el acceso'}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          active
            ? 'border-red-200 text-red-600 hover:bg-red-50'
            : 'border-green-200 text-green-600 hover:bg-green-50'
        }`}
      >
        {pending ? '...' : active ? 'Desactivar' : 'Activar'}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full mt-1 z-10 w-56 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 shadow-sm">
          {error}
        </span>
      )}
    </span>
  )
}
