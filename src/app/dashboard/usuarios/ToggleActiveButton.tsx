'use client'

import { useTransition } from 'react'
import { toggleUserActive } from './actions'

export default function ToggleActiveButton({
  userId,
  active,
}: {
  userId: string
  active: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await toggleUserActive(userId, !active)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        active
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'border-green-200 text-green-600 hover:bg-green-50'
      }`}
    >
      {pending ? '...' : active ? 'Desactivar' : 'Activar'}
    </button>
  )
}
