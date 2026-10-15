'use client'

// src/components/dashboard/LinkPendingOverlay.tsx
// Se coloca DENTRO de un <Link>. Mientras esa navegación carga, cubre la pantalla:
// bloquea cualquier clic (evita dobles clics) y muestra un aviso de carga.
// El bloqueo es inmediato; el aviso aparece tras ~150 ms para no parpadear si carga rápido.

import { useLinkStatus } from 'next/link'
import { createPortal } from 'react-dom'

export default function LinkPendingOverlay({ label = 'Cargando…' }: { label?: string }) {
  const { pending } = useLinkStatus()
  if (!pending || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-wait"
      // El portal sigue dentro del <Link> en el árbol de React: cortar el clic para que no navegue otra vez
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-white/50" style={{ animation: 'rf-fade-in .2s ease-out .15s both' }} />
      <div className="relative flex items-center gap-2.5 bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 text-sm text-gray-700"
        style={{ animation: 'rf-fade-in .2s ease-out .15s both' }}>
        <span className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
        {label}
      </div>
    </div>,
    document.body,
  )
}
