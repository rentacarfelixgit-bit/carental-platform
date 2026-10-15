// src/lib/photoAngles.ts
// Ángulos de foto de un vehículo. Los usan las fotos base de Flotilla (vehicle_photos)
// y las fotos de inspección de entrega / recepción (inspection_photos).

export type PhotoAngle = 'front' | 'rear' | 'left' | 'right' | 'interior' | 'other'

export const PHOTO_ANGLES: PhotoAngle[] = ['front', 'rear', 'left', 'right', 'interior', 'other']

export const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front:    'Frente',
  rear:     'Trasera',
  left:     'Lateral izq.',
  right:    'Lateral der.',
  interior: 'Interior',
  other:    'Otro',
}

/**
 * Ángulos exteriores obligatorios cuando la inspección necesita un juego completo de fotos
 * (vehículo sin fotos base registradas). Para hacerlos solo sugeridos, dejar este arreglo vacío.
 */
export const REQUIRED_INSPECTION_ANGLES: PhotoAngle[] = ['front', 'rear', 'left', 'right']

export function isPhotoAngle(v: unknown): v is PhotoAngle {
  return typeof v === 'string' && (PHOTO_ANGLES as string[]).includes(v)
}

export function angleLabel(v: string | null | undefined) {
  return v && isPhotoAngle(v) ? ANGLE_LABELS[v] : null
}
