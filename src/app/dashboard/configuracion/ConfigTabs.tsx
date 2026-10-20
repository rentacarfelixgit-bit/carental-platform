'use client'

// src/app/dashboard/configuracion/ConfigTabs.tsx
// Navegación por pestañas de Configuración. Los paneles se mantienen montados
// (solo se ocultan) para no perder cambios sin guardar al cambiar de pestaña.
// La pestaña activa se refleja en la URL (?tab=...) para poder compartirla o recargar.

import { useEffect, useRef, useState, type ReactNode } from 'react'

export type ConfigTabId = 'negocio' | 'moneda' | 'impuestos' | 'precios' | 'tarifas'

export interface ConfigTab {
  id: ConfigTabId
  label: string
  description: string
  /** path(s) de un ícono outline de 24x24 */
  icon: string
  /** Texto pequeño opcional junto al título (ej. "12 vehículos") */
  badge?: string
  content: ReactNode
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export default function ConfigTabs({ tabs, initialTab }: { tabs: ConfigTab[]; initialTab: ConfigTabId }) {
  const [active, setActive] = useState<ConfigTabId>(initialTab)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Sincronizar la URL sin recargar la página
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('tab') !== active) {
      url.searchParams.set('tab', active)
      window.history.replaceState(null, '', url.toString())
    }
  }, [active])

  // Navegación con flechas (patrón ARIA de tabs)
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
    setActive(tabs[next].id)
    tabRefs.current[tabs[next].id]?.focus()
  }

  return (
    <div>
      {/* ── Barra de pestañas ─────────────────────────────────────────────── */}
      <div style={{ minHeight: '42px' }} className="border-b border-gray-200 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div role="tablist" aria-label="Secciones de configuración" className="flex gap-1 min-w-max">
          {tabs.map((t, i) => {
            const selected = t.id === active
            return (
              <button
                key={t.id}
                ref={el => { tabRefs.current[t.id] = el }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.id)}
                onKeyDown={e => onKeyDown(e, i)}
                className={`relative inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected ? 'text-blue-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon d={t.icon} className={`w-4 h-4 ${selected ? 'text-blue-600' : 'text-gray-400'}`} />
                {t.label}
                <span
                  className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-colors ${selected ? 'bg-blue-600' : 'bg-transparent'}`}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Paneles ───────────────────────────────────────────────────────── */}
      {tabs.map(t => (
        <section
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="pt-6"
        >
          <header className="flex items-start gap-3 mb-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon d={t.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">{t.label}</h2>
                {t.badge && (
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{t.badge}</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
            </div>
          </header>
          {t.content}
        </section>
      ))}
    </div>
  )
}
