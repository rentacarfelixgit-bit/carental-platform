'use client'

// src/app/dashboard/reservas/[id]/inspecciones/[type]/PhotoUploader.tsx
// Fotos de inspección con ángulo (Frente, Trasera, Lateral izq./der., Interior, Otro),
// igual que las fotos base de Flotilla. Muestra qué ángulos obligatorios faltan.

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ANGLE_LABELS, PHOTO_ANGLES, type PhotoAngle } from '@/lib/photoAngles'

export interface InspectionPhotoInput {
  path: string
  angle: PhotoAngle
}

interface Props {
  inspectionId: string   // UUID temporal generado antes del submit
  tenantId: string
  onChange: (photos: InspectionPhotoInput[]) => void
  /** Ángulos que deben quedar cubiertos (se muestran como checklist). Vacío = ninguno obligatorio. */
  requiredAngles?: PhotoAngle[]
}

interface PhotoPreview {
  key: number
  localUrl: string
  angle: PhotoAngle
  storagePath: string | null  // null = subiendo
  error?: string
}

// Comprime la imagen a máx 1200px y calidad 78% JPEG (~200-350 KB por foto)
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const MAX_PX = 1200
    const QUALITY = 0.78
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
        else                { width = Math.round(width * MAX_PX / height);  height = MAX_PX }
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

let keySeq = 0

export default function PhotoUploader({ inspectionId, tenantId, onChange, requiredAngles = [] }: Props) {
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [angle, setAngle]   = useState<PhotoAngle>(requiredAngles[0] ?? 'front')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Notificar al padre las fotos ya subidas (con su ángulo)
  useEffect(() => {
    onChange(
      photos
        .filter(p => p.storagePath)
        .map(p => ({ path: p.storagePath as string, angle: p.angle }))
    )
  }, [photos, onChange])

  const covered = new Set(photos.filter(p => p.storagePath || !p.error).map(p => p.angle))
  const missing = requiredAngles.filter(a => !covered.has(a))

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const currentAngle = angle
    const list = Array.from(files)

    const previews: PhotoPreview[] = list.map(f => ({
      key: ++keySeq,
      localUrl: URL.createObjectURL(f),
      angle: currentAngle,
      storagePath: null,
    }))
    setPhotos(prev => [...prev, ...previews])

    // Pasar al siguiente ángulo obligatorio que falte, para agilizar la toma
    const nowCovered = new Set([...covered, currentAngle])
    const next = requiredAngles.find(a => !nowCovered.has(a))
    if (next) setAngle(next)

    await Promise.all(list.map(async (file, i) => {
      const compressed = await compressImage(file)
      const path = `${tenantId}/${inspectionId}/${Date.now()}_${currentAngle}_${i}.jpg`
      const { error } = await supabase.storage
        .from('inspection-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

      const k = previews[i].key
      setPhotos(prev => prev.map(p => p.key === k
        ? { ...p, storagePath: error ? null : path, error: error?.message }
        : p))
    }))

    if (inputRef.current) inputRef.current.value = ''
  }

  function removePhoto(key: number) {
    setPhotos(prev => prev.filter(p => p.key !== key))
  }

  return (
    <div className="space-y-3">
      {/* Checklist de ángulos obligatorios */}
      {requiredAngles.length > 0 && (
        <div className={`rounded-lg border px-3 py-2.5 ${missing.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <p className={`text-xs font-medium mb-1.5 ${missing.length ? 'text-amber-800' : 'text-green-800'}`}>
            {missing.length
              ? `Faltan ${missing.length} ángulo${missing.length !== 1 ? 's' : ''} obligatorio${missing.length !== 1 ? 's' : ''}`
              : 'Todos los ángulos obligatorios están cubiertos'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {requiredAngles.map(a => {
              const ok = covered.has(a)
              return (
                <span key={a} className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-green-700' : 'text-amber-700'}`}>
                  {ok ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="w-3 h-3 rounded-full border-2 border-current" />
                  )}
                  {ANGLE_LABELS[a]}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Grid de fotos con su ángulo */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.key} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.localUrl} alt={ANGLE_LABELS[photo.angle]} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-xs font-medium bg-black/60 text-white rounded">
                {ANGLE_LABELS[photo.angle]}
              </span>
              {photo.storagePath === null && !photo.error && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              )}
              {photo.error && (
                <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center p-1">
                  <p className="text-white text-xs text-center">Error al subir</p>
                </div>
              )}
              {(photo.storagePath !== null || photo.error) && (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.key)}
                  aria-label="Quitar foto"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selector de ángulo (mismo que en Flotilla) */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Ángulo de la foto</label>
        <div className="flex flex-wrap gap-2">
          {PHOTO_ANGLES.map(key => {
            const done = covered.has(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAngle(key)}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors ${
                  angle === key
                    ? 'bg-blue-600 border-blue-600 text-white font-medium'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {done && angle !== key && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                {ANGLE_LABELS[key]}
              </button>
            )
          })}
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
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Galería
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <p className="text-xs text-gray-400 text-center">
        {photos.length === 0
          ? 'Selecciona el ángulo antes de tomar o subir la foto · Se comprimen automáticamente'
          : `${photos.filter(p => p.storagePath).length} de ${photos.length} foto${photos.length !== 1 ? 's' : ''} subida${photos.length !== 1 ? 's' : ''} · Foto actual: ${ANGLE_LABELS[angle]}`}
      </p>
    </div>
  )
}
