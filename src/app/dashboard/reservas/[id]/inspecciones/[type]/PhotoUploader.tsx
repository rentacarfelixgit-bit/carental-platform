'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  inspectionId: string   // UUID temporal generado antes del submit, o post-submit
  tenantId: string
  onChange: (paths: string[]) => void
}

interface PhotoPreview {
  localUrl: string
  storagePath: string | null  // null = subiendo
  error?: string
}

export default function PhotoUploader({ inspectionId, tenantId, onChange }: Props) {
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Notificar al padre cuando cambien los paths subidos
  useEffect(() => {
    const paths = photos.map(p => p.storagePath).filter(Boolean) as string[]
    onChange(paths)
  }, [photos, onChange])

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

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    const newPreviews: PhotoPreview[] = Array.from(files).map(f => ({
      localUrl: URL.createObjectURL(f),
      storagePath: null,
    }))

    setPhotos(prev => [...prev, ...newPreviews])
    const startIdx = photos.length

    // Comprimir y subir en paralelo
    const uploadResults = await Promise.all(
      Array.from(files).map(async (file, i) => {
        const compressed = await compressImage(file)
        const path = `${tenantId}/${inspectionId}/${Date.now()}_${i}.jpg`

        const { error } = await supabase.storage
          .from('inspection-photos')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

        return error ? { error: error.message, path: null } : { error: null, path }
      })
    )

    setPhotos(prev => {
      const updated = [...prev]
      uploadResults.forEach((result, i) => {
        updated[startIdx + i] = {
          ...updated[startIdx + i],
          storagePath: result.path,
          error: result.error ?? undefined,
        }
      })
      return updated
    })
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      const updated = prev.filter((_, i) => i !== idx)
      const paths = updated.map(p => p.storagePath).filter(Boolean) as string[]
      onChange(paths)
      return updated
    })
  }

  return (
    <div>
      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.localUrl}
                alt={`Foto ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Overlay: subiendo */}
              {photo.storagePath === null && !photo.error && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              )}
              {/* Overlay: error */}
              {photo.error && (
                <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center p-1">
                  <p className="text-white text-xs text-center">Error al subir</p>
                </div>
              )}
              {/* Botón eliminar */}
              {photo.storagePath !== null && (
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
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

      {/* Botones de captura */}
      <div className="flex gap-2">
        {/* Cámara del celular */}
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
        {/* Galería */}
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

      <p className="text-xs text-gray-400 mt-2 text-center">
        {photos.length === 0
          ? 'Las fotos se suben automáticamente al seleccionarlas'
          : `${photos.filter(p => p.storagePath).length} de ${photos.length} foto${photos.length !== 1 ? 's' : ''} subida${photos.length !== 1 ? 's' : ''}`}
      </p>
    </div>
  )
}
