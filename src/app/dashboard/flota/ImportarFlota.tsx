'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { importVehicles } from './actions'

interface ImportResult {
  imported: number
  skipped: number
  errors: { row: number; reason: string }[]
}

// Mapeo de encabezados del Excel a campos internos
const COL_MAP: Record<string, string> = {
  'marca': 'brand',
  'modelo': 'model',
  'año': 'year',
  'color': 'color',
  'placas': 'plates',
  'tarifa diaria': 'daily_rate',
  'tarifa diaria (rd$)': 'daily_rate',
  'vin': 'vin',
  'póliza de seguro': 'insurance_policy',
  'poliza de seguro': 'insurance_policy',
  'venc. seguro': 'insurance_expiry',
  'vencimiento seguro': 'insurance_expiry',
  'venc. permiso': 'permit_expiry',
  'vencimiento permiso': 'permit_expiry',
  'notas': 'notes',
}

/** Normaliza un encabezado crudo a clave de mapeo */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\s*\*.*/, '')               // quitar " *" y lo que sigue
    .replace(/\s*\(aaaa.*/, '')           // quitar "(aaaa-mm-dd)" etc
    .replace(/[^\w\s.áéíóúñü]/gi, '')    // quitar símbolos raros
    .trim()
}

/** Carga SheetJS desde CDN si no está ya cargado */
function loadSheetJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).XLSX) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar la librería de lectura Excel'))
    document.head.appendChild(script)
  })
}

/** Formatea un valor de celda de fecha al formato AAAA-MM-DD */
function formatDate(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val).trim()
}

export default function ImportarFlota() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Pre-cargar SheetJS cuando el modal se abra
  useEffect(() => {
    if (open) loadSheetJS().catch(() => {/* se volverá a intentar al importar */ })
  }, [open])

  function reset() {
    setFile(null)
    setResult(null)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function close() { setOpen(false); reset() }

  async function handleImport() {
    if (!file) return
    setParseError(null)
    setResult(null)

    let rows: Record<string, string>[]
    try {
      await loadSheetJS()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX = (window as any).XLSX
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })

      // Usar la hoja "Flota" si existe, si no la primera
      const sheetName: string =
        wb.SheetNames.find((n: string) => n.toLowerCase().includes('flota')) ?? wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]

      // raw: array de arrays
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Buscar la fila de encabezados (la que contiene "Marca" o "marca")
      let headerRowIdx = raw.findIndex((r: unknown[]) =>
        r.some((cell: unknown) => String(cell).toLowerCase().includes('marca'))
      )
      if (headerRowIdx === -1) headerRowIdx = 3

      const headers: string[] = (raw[headerRowIdx] as unknown[]).map((h: unknown) => String(h).trim())

      // Construir mapa índice → campo
      const fieldIndices: Record<string, number> = {}
      headers.forEach((h, i) => {
        const key = normalizeHeader(h)
        const mapped = COL_MAP[key]
        if (mapped) fieldIndices[mapped] = i
      })

      rows = (raw.slice(headerRowIdx + 1) as unknown[][])
        .filter((r: unknown[]) => r.some((c: unknown) => String(c).trim() !== ''))
        .map((r: unknown[]) => {
          const obj: Record<string, string> = {}
          for (const [field, idx] of Object.entries(fieldIndices)) {
            const val = r[idx]
            // Fechas que SheetJS convirtió a Date
            if (field.includes('expiry') || field.includes('expiracion')) {
              obj[field] = formatDate(val)
            } else {
              obj[field] = String(val ?? '').trim()
            }
          }
          return obj
        })
        .filter((r: Record<string, string>) => Object.values(r).some(v => v !== ''))

      if (rows.length === 0) {
        setParseError('El archivo no contiene filas de datos. Asegúrate de usar la plantilla y llenar desde la fila 6.')
        return
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setParseError(`No se pudo leer el archivo: ${msg}`)
      return
    }

    startTransition(async () => {
      const res = await importVehicles(rows)
      setResult(res)
      if (inputRef.current) inputRef.current.value = ''
      setFile(null)
    })
  }

  return (
    <>
      {/* Botón disparador */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        Importar
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Importar flota</h2>
                <p className="text-sm text-gray-500 mt-0.5">Agrega múltiples vehículos desde un archivo Excel</p>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Plantilla */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-900 mb-1">Formato requerido</p>
                <p className="text-sm text-blue-700 mb-3">
                  Para importar correctamente usa nuestra plantilla. Incluye instrucciones, columnas exactas y una fila de ejemplo en la fila 5.
                </p>
                <a
                  href="/templates/plantilla-flota.xlsx"
                  download="plantilla-flota.xlsx"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Descargar plantilla (.xlsx)
                </a>
                <div className="flex items-start gap-2 bg-blue-100 rounded-lg px-3 py-2 mb-3">
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <p className="text-xs text-blue-800">
                    La <strong>fila 5 es un ejemplo</strong> — reemplázala o bórrala antes de importar. Si la dejas, será ignorada automáticamente al importar.
                  </p>
                </div>
              </div>

              {/* Columnas */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Columnas de la plantilla</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { label: 'Marca', req: true },
                    { label: 'Modelo', req: true },
                    { label: 'Año', req: true },
                    { label: 'Color', req: true },
                    { label: 'Placas', req: true },
                    { label: 'Tarifa Diaria', req: true },
                    { label: 'VIN', req: false },
                    { label: 'Póliza Seguro', req: false },
                    { label: 'Venc. Seguro', req: false },
                    { label: 'Venc. Permiso', req: false },
                    { label: 'Notas', req: false },
                  ].map(({ label, req }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${req ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className={req ? 'text-gray-700 font-medium' : 'text-gray-400'}>{label}</span>
                      {req && <span className="text-blue-500 font-bold">*</span>}
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Upload o resultado */}
              {!result ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Ya tienes la plantilla? Selecciona tu archivo
                  </p>
                  <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}>
                    <svg className={`w-8 h-8 ${file ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    {file ? (
                      <span className="text-sm font-medium text-blue-700">{file.name}</span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Haz clic o arrastra tu archivo <strong>.xlsx</strong> aquí
                      </span>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={e => { setFile(e.target.files?.[0] ?? null); setParseError(null) }}
                    />
                  </label>

                  {parseError && (
                    <p className="mt-2 text-sm text-red-600 flex items-start gap-1.5">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {parseError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {result.imported > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-green-800">
                          {result.imported} vehículo{result.imported !== 1 ? 's' : ''} importado{result.imported !== 1 ? 's' : ''} correctamente
                        </p>
                        {result.skipped > 0 && (
                          <p className="text-xs text-green-700 mt-0.5">
                            {result.skipped} fila{result.skipped !== 1 ? 's' : ''} omitida{result.skipped !== 1 ? 's' : ''} (placas duplicadas u obligatorios vacíos)
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {result.imported === 0 && result.errors.length === 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                      No se importó ningún vehículo. Revisa que el archivo tenga datos y use el formato correcto.
                    </div>
                  )}

                  {result.errors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm font-semibold text-red-800 mb-2">
                        {result.errors.length} fila{result.errors.length !== 1 ? 's' : ''} con error
                      </p>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {result.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-700">
                            <span className="font-medium">Fila {e.row}:</span> {e.reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              {!result ? (
                <>
                  <button
                    onClick={close}
                    className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!file || pending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Importando...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Importar vehículos
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={reset} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
                    Importar otro archivo
                  </button>
                  <button onClick={close} className="flex-1 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
