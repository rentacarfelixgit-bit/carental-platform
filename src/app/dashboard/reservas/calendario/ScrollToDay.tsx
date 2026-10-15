'use client'

// src/app/dashboard/reservas/calendario/ScrollToDay.tsx
// Al volver al calendario desde una renta, lleva la vista al día de origen.

import { useEffect } from 'react'

export default function ScrollToDay({ day }: { day: number | null }) {
  useEffect(() => {
    if (!day) return
    // Hay una versión de escritorio y otra móvil; se usa la que esté visible
    const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-cal-day="${day}"]`))
      .find(e => e.offsetParent !== null)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [day])
  return null
}
