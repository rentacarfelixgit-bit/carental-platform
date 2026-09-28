'use client'

import { useTransition } from 'react'
import { deleteBlock } from './actions'

export default function DeleteBlockButton({ blockId }: { blockId: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('¿Eliminar este bloqueo?')) return
    startTransition(async () => {
      await deleteBlock(blockId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
    >
      {pending ? '...' : 'Eliminar'}
    </button>
  )
}
