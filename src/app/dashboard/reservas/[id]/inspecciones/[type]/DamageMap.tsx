'use client'

// src/app/dashboard/reservas/[id]/inspecciones/[type]/DamageMap.tsx
// Diagrama SVG interactivo de un vehículo visto desde arriba.
// El usuario hace clic para marcar puntos de daño.

import { useState, useRef } from 'react'

export type VehicleZone = 'front' | 'rear' | 'left' | 'right' | 'top' | 'interior'
export type DamageSeverity = 'scratch' | 'dent' | 'crack' | 'missing' | 'other'

export interface DamagePoint {
  id: string
  x_pct: number
  y_pct: number
  zone: VehicleZone
  severity: DamageSeverity
  description: string
}

const SEVERITY_LABELS: Record<DamageSeverity, string> = {
  scratch: 'Rayón',
  dent:    'Abolladura',
  crack:   'Grieta',
  missing: 'Pieza faltante',
  other:   'Otro',
}

const SEVERITY_COLORS: Record<DamageSeverity, string> = {
  scratch: '#f59e0b',
  dent:    '#ef4444',
  crack:   '#8b5cf6',
  missing: '#ec4899',
  other:   '#6b7280',
}

function detectZone(xPct: number, yPct: number): VehicleZone {
  if (yPct < 22)                          return 'front'
  if (yPct > 78)                          return 'rear'
  if (xPct < 20)                          return 'left'
  if (xPct > 80)                          return 'right'
  if (yPct > 30 && yPct < 70 && xPct > 25 && xPct < 75) return 'interior'
  return 'top'
}

const ZONE_LABELS: Record<VehicleZone, string> = {
  front:    'Frontal',
  rear:     'Trasera',
  left:     'Lateral izq.',
  right:    'Lateral der.',
  top:      'Techo/capó',
  interior: 'Interior',
}

interface Props {
  onChange: (points: DamagePoint[]) => void
}

export default function DamageMap({ onChange }: Props) {
  const [points, setPoints]       = useState<DamagePoint[]>([])
  const [activeSeverity, setActiveSeverity] = useState<DamageSeverity>('scratch')
  const svgRef = useRef<SVGSVGElement>(null)

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width)  * 100
    const yPct = ((e.clientY - rect.top)  / rect.height) * 100

    const newPoint: DamagePoint = {
      id:          crypto.randomUUID(),
      x_pct:       Math.round(xPct * 10) / 10,
      y_pct:       Math.round(yPct * 10) / 10,
      zone:        detectZone(xPct, yPct),
      severity:    activeSeverity,
      description: '',
    }

    const updated = [...points, newPoint]
    setPoints(updated)
    onChange(updated)
  }

  function removePoint(id: string) {
    const updated = points.filter(p => p.id !== id)
    setPoints(updated)
    onChange(updated)
  }

  function updatePointDescription(id: string, description: string) {
    const updated = points.map(p => p.id === id ? { ...p, description } : p)
    setPoints(updated)
    onChange(updated)
  }

  function updatePointSeverity(id: string, severity: DamageSeverity) {
    const updated = points.map(p => p.id === id ? { ...p, severity } : p)
    setPoints(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Selector de severidad activa */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Tipo de daño a marcar</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(SEVERITY_LABELS) as [DamageSeverity, string][]).map(([sev, label]) => (
            <button
              key={sev}
              type="button"
              onClick={() => setActiveSeverity(sev)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeSeverity === sev
                  ? 'text-white border-transparent'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              style={activeSeverity === sev ? { backgroundColor: SEVERITY_COLORS[sev] } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Diagrama SVG */}
      <div className="relative">
        <p className="text-xs text-gray-400 mb-2 text-center">Haz clic en el diagrama para marcar daños</p>
        <svg
          ref={svgRef}
          viewBox="0 0 200 400"
          onClick={handleSvgClick}
          className="w-full max-w-[220px] mx-auto block cursor-crosshair border border-gray-200 rounded-xl bg-gray-50"
        >
          {/* Sombra vehículo */}
          <ellipse cx="100" cy="200" rx="72" ry="170" fill="#e5e7eb" />

          {/* Carrocería principal */}
          <rect x="35" y="60" width="130" height="280" rx="40" fill="#d1d5db" stroke="#9ca3af" strokeWidth="2" />

          {/* Capó */}
          <ellipse cx="100" cy="90" rx="55" ry="35" fill="#e9eaeb" stroke="#9ca3af" strokeWidth="1.5" />
          {/* Parabrisas delantero */}
          <ellipse cx="100" cy="130" rx="48" ry="22" fill="#bfdbfe" opacity="0.7" stroke="#9ca3af" strokeWidth="1" />

          {/* Techo */}
          <rect x="52" y="148" width="96" height="104" rx="8" fill="#c8cacf" stroke="#9ca3af" strokeWidth="1" />

          {/* Parabrisas trasero */}
          <ellipse cx="100" cy="270" rx="48" ry="22" fill="#bfdbfe" opacity="0.7" stroke="#9ca3af" strokeWidth="1" />
          {/* Maletero */}
          <ellipse cx="100" cy="310" rx="55" ry="35" fill="#e9eaeb" stroke="#9ca3af" strokeWidth="1.5" />

          {/* Ruedas */}
          <rect x="22" y="80"  width="18" height="38" rx="5" fill="#374151" />
          <rect x="160" y="80"  width="18" height="38" rx="5" fill="#374151" />
          <rect x="22" y="282" width="18" height="38" rx="5" fill="#374151" />
          <rect x="160" y="282" width="18" height="38" rx="5" fill="#374151" />

          {/* Etiquetas de zona (sutiles) */}
          <text x="100" y="32"  textAnchor="middle" fontSize="9" fill="#9ca3af">Frontal</text>
          <text x="100" y="388" textAnchor="middle" fontSize="9" fill="#9ca3af">Trasera</text>
          <text x="8"   y="205" textAnchor="middle" fontSize="9" fill="#9ca3af" transform="rotate(-90,8,205)">Izq.</text>
          <text x="193" y="205" textAnchor="middle" fontSize="9" fill="#9ca3af" transform="rotate(90,193,205)">Der.</text>

          {/* Puntos de daño marcados */}
          {points.map((p, i) => (
            <g key={p.id}>
              <circle
                cx={p.x_pct * 2}
                cy={p.y_pct * 4}
                r="9"
                fill={SEVERITY_COLORS[p.severity]}
                opacity="0.9"
                stroke="white"
                strokeWidth="1.5"
              />
              <text
                x={p.x_pct * 2}
                y={p.y_pct * 4 + 4}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                fill="white"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Lista de puntos marcados */}
      {points.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">{points.length} punto{points.length !== 1 ? 's' : ''} de daño</p>
          {points.map((p, i) => (
            <div key={p.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: SEVERITY_COLORS[p.severity] }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs text-gray-600">{ZONE_LABELS[p.zone]}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removePoint(p.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Eliminar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={p.severity}
                  onChange={e => updatePointSeverity(p.id, e.target.value as DamageSeverity)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-lg bg-white"
                >
                  {(Object.entries(SEVERITY_LABELS) as [DamageSeverity, string][]).map(([sev, label]) => (
                    <option key={sev} value={sev}>{label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Descripción (opcional)"
                  value={p.description}
                  onChange={e => updatePointDescription(p.id, e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
