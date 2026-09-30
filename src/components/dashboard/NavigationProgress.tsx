'use client'

// NavigationProgress.tsx
// Barra delgada de progreso en la parte superior durante navegación entre secciones

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

function ProgressBar() {
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [width,   setWidth]   = useState(0)
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef<string>('')

  const current = pathname + searchParams.toString()

  // Al arrancar una navegación (antes de que pathname cambie), no hay hook disponible,
  // pero podemos detectar el cambio comparando con el valor previo.
  useEffect(() => {
    if (prevRef.current === '' ) { prevRef.current = current; return }
    if (prevRef.current === current) return

    // Pathname cambió → navegación completada, ocultar barra
    setWidth(100)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setVisible(false); setWidth(0) }, 300)

    prevRef.current = current
  }, [current])

  // Exponer método para que los Links puedan arrancar la barra
  useEffect(() => {
    function start() {
      setVisible(true)
      setWidth(30)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setWidth(70), 200)
    }

    // Intercepta clicks en links del sidebar
    const links = document.querySelectorAll('nav a, aside a')
    links.forEach(el => el.addEventListener('click', start))
    return () => links.forEach(el => el.removeEventListener('click', start))
  })

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 3,
        width: `${width}%`,
        background: '#2563eb',
        transition: 'width 0.25s ease, opacity 0.3s',
        opacity: width === 100 ? 0 : 1,
        zIndex: 9999,
        borderRadius: '0 2px 2px 0',
      }}
    />
  )
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  )
}
