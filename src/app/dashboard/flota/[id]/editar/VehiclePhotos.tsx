'use client'

// src/app/dashboard/flota/[id]/editar/VehiclePhotos.tsx
// Galería de fotos base de carrocería — sube, muestra y elimina fotos por vehículo.

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Angle = 'front' | 'rear' | 'left' | 'right' | 'interior' | 'other'

const ANGLE_LABELS: Record<Angle, string> = {
  front:    'Frente',
  rear:     'Trasera',
  left:     'Lateral izq.',
  right:    'Lateral der.',
  interior: 'Interior',
  other:    'Otro',
}

interface ExistingPhoto {
  id: string
  storage_path: string
  angle: Angle | null
  notes: string | null
  signedUrl: string | null   // null mientras se obtiene
}

interface PendingPhoto {
  localUrl: string
  angle: Angle
  storagePath: string | null  // null = subiendo
  error?: string
}

interface Props {
  vehicleId: string
  tenantId: string
}

// ── Compresión ────────────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const MAX_PX  = 1200
    const QUALITY = 0.78
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
        else                { width  = Math.round(width  * MAX_PX / height); height = MAX_PX }
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', QUALITY)
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function VehiclePhotos({ vehicleId, tenantId }: Props) {
  const supabase   = createClient()
  const inputRef   = useRef<HTMLInputElement>(null)

  const [existing, setExisting]   = useState<ExistingPhoto[]>([])
  const [pending,  setPending]    = useState<PendingPhoto[]>([])
  const [loading,  setLoading]    = useState(true)
  const [angle,    setAngle]      = useState<Angle>('front')
  const [deleting, setDeleting]   = useState<string | null>(null)

  // ── Cargar fotos existentes ──────────────────────────────────────────────

  const loadPhotos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vehicle_photos')
      .select('id, storage_path, angle, notes')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: true })

    if (error || !data) { setLoading(false); return }

    // Obtener signed URLs (bucket privado, válidas 1 hora)
    const photos: ExistingPhoto[] = await Promise.all(
      data.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from('vehicle-photos')
          .createSignedUrl(row.storage_path, 3600)
        return {
          id:           row.id,
          storage_path: row.storage_path,
          angle:        (row.angle as Angle) ?? null,
          notes:        row.notes ?? null,
          signedUrl:    signed?.signedUrl ?? null,
        }
      })
    )

    setExisting(photos)
    setLoading(false)
  }, [vehicleId, supabase])

  useEffect(() => { loadPhotos() }, [loadPhotos])

  // ── Subir fotos nuevas ───────────────────────────────────────────────────

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const newPending: PendingPhoto[] = Array.from(files).map(f => ({
      localUrl:    URL.createObjectURL(f),
      angle,
      storagePath: null,
    }))
    const startIdx = pending.length
    setPending(prev => [...prev, ...newPending])

    const results = await Promise.all(
      Array.from(files).map(async (file, i) => {
        const compressed  = await compressImage(file)
        const storagePath = `${tenantId}/${vehicleId}/${Date.now()}_${i}.jpg`

        const { error: uploadErr } = await supabase.storage
          .from('vehicle-photos')
          .upload(storagePath, compressed, { contentType: 'image/jpeg', upsert: false })

        if (uploadErr) return { storagePath: null, error: uploadErr.message }

        // Registrar en DB
        const { error: dbErr } = await supabase
          .from('vehicle_photos')
          .insert({ vehicle_id: vehicleId, tenant_id: tenantId, storage_path: storagePath, angle })

        if (dbErr) {
          // Limpiar Storage si falla la DB
          await supabase.storage.from('vehicle-photos').remove([storagePath])
          return { storagePath: null, error: dbErr.message }
        }

        return { storagePath, error: null }
      })
    )

    // Actualizar previews
    setPending(prev => {
      const updated = [...prev]
      results.forEach((r, i) => {
        updated[startIdx + i] = { ...updated[startIdx + i], storagePath: r.storagePath, error: r.error ?? undefined }
      })
      return updated
    })

    // Recargar fotos existentes para mostrar las nuevas con signed URL
    const allOk = results.every(r => !r.error)
    if (allOk) {
      await loadPhotos()
      setPending([])
    }
  }

  // ── Eliminar foto existente ──────────────────────────────────────────────

  async function deletePhoto(photo: ExistingPhoto) {
    setDeleting(photo.id)

    await supabase.storage.from('vehicle-photos').remove([photo.storage_path])
    await supabase.from('vehicle_photos').delete().eq('id', photo.id)

    setExisting(prev => prev.filter(p => p.id !== photo.id))
    setDeleting(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-6 mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700">
          Fotos de carrocería
          <span className="ml-2 text-xs text-gray-400 font-normal">
            {existing.length} foto{existing.length !== 1 ? 's' : ''} registrada{existing.length !== 1 ? 's' : ''}
          </span>
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Registro fotográfico permanente del vehículo. Se mostrará durante las inspecciones.
        </p>
      </div>

      <div className="p-5 space-y-5">

        {/* Grid de fotos existentes */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : existing.length === 0 && pending.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-sm">Sin fotos registradas aún</p>
            <p className="text-xs mt-1">Agrega fotos de los 4 ángulos principales del vehículo</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

            {/* Fotos existentes */}
            {existing.map(photo => (
              <div key={photo.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                {photo.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.signedUrl}
                    alt={photo.angle ? ANGLE_LABELS[photo.angle] : 'Foto'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                  </div>
                )}

                {/* Badge de ángulo */}
                {photo.angle && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-xs font-medium bg-black/60 text-white rounded">
                    {ANGLE_LABELS[photo.angle]}
                  </span>
                )}

                {/* Botón eliminar (visible en hover) */}
                <button
                  type="button"
                  onClick={() => deletePhoto(photo)}
                  disabled={deleting === photo.id}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-60"
                >
                  {deleting === photo.id ? (
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
            ))}

            {/* Fotos en proceso de subida */}
            {pending.map((photo, idx) => (
              <div key={`pending-${idx}`} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.localUrl} alt="Subiendo..." className="w-full h-full object-cover" />

                {!photo.error && photo.storagePath === null && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  </div>
                )}
                {photo.error && (
                  <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center p-2">
                    <p className="text-white text-xs text-center">Error al subir</p>
                  </div>
                )}

                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-xs font-medium bg-black/60 text-white rounded">
                  {ANGLE_LABELS[photo.angle]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Sección de subida */}
        <div className="border-t border-gray-100 pt-4 space-y-3">

          {/* Selector de ángulo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Ángulo de la foto
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(ANGLE_LABELS) as [Angle, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAngle(key)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    angle === key
                      ? 'bg-blue-600 border-blue-600 text-white font-medium'
                      : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Botones de captura */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.setAttribute('capture', 'environment')
                  inputRef.current.click()
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Tomar foto
            </button>

            <button
              type="button"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.removeAttribute('capture')
                  inputRef.current.click()
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Galería
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Selecciona el ángulo antes de subir · Las fotos se comprimen automáticamente
          </p>
        </div>

      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
