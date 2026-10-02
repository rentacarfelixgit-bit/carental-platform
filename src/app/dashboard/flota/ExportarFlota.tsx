'use client'

// src/app/dashboard/flota/ExportarFlota.tsx
// Botón que exporta toda la flota del tenant a un archivo Excel

import { useState } from 'react'
import { exportVehicles } from './actions'

const STATUS_LABELS: Record<string, string> = {
  available:   'Disponible',
  reserved:    'Reservado',
  in_use:      'En uso',
  maintenance: 'Mantenimiento',
  retained:    'Retenido',
}

/** Carga SheetJS desde CDN si no está ya disponible */
function loadSheetJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).XLSX) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar la librería de exportación'))
    document.head.appendChild(script)
  })
}

export default function ExportarFlota() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleExport() {
    setLoading(true)
    setError(null)

    try {
      // 1. Obtener datos del servidor
      const { data, error: fetchError } = await exportVehicles()
      if (fetchError) throw new Error(fetchError)
      if (!data || data.length === 0) {
        setError('No hay vehículos en la flota para exportar.')
        return
      }

      // 2. Cargar SheetJS
      await loadSheetJS()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX = (window as any).XLSX

      // 3. Construir filas
      const headers = [
        'Marca', 'Modelo', 'Año', 'Color', 'Placas',
        'Tarifa Diaria (RD$)', 'Estado', 'Activo',
        'VIN', 'Póliza de Seguro', 'Venc. Seguro (AAAA-MM-DD)',
        'Venc. Permiso (AAAA-MM-DD)', 'Notas',
      ]

      const rows = data.map(v => [
        v.brand,
        v.model,
        v.year,
        v.color,
        v.plates,
        v.daily_rate ?? '',
        STATUS_LABELS[v.status] ?? v.status,
        v.active ? 'Sí' : 'No',
        v.vin ?? '',
        v.insurance_policy ?? '',
        v.insurance_expiry ?? '',
        v.permit_expiry ?? '',
        v.notes ?? '',
      ])

      // 4. Crear workbook
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

      // Ancho de columnas
      ws['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 10 }, { wch: 12 },
        { wch: 18 }, { wch: 14 }, { wch: 7 },
        { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 30 },
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Flota')

      // 5. Descargar
      const fecha = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `flota-${fecha}.xlsx`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
        {loading ? 'Exportando...' : 'Exportar'}
      </button>

      {error && (
        <div className="absolute top-full mt-1 right-0 z-10 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 w-64 shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}
