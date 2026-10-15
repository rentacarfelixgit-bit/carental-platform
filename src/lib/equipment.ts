// src/lib/equipment.ts
// Nombres y colores del inventario de equipo (GPS, hotspots, sillas de bebé…).

export type EquipmentType      = 'gps' | 'hotspot' | 'baby_seat' | 'other'
export type EquipmentStatus    = 'available' | 'assigned' | 'maintenance' | 'lost' | 'retired'
export type EquipmentCondition = 'ok' | 'damaged' | 'missing'

export const EQUIPMENT_TYPES: Record<EquipmentType, { label: string; prefix: string }> = {
  gps:       { label: 'GPS',            prefix: 'GPS' },
  hotspot:   { label: 'Hotspot / WiFi', prefix: 'HOT' },
  baby_seat: { label: 'Silla de bebé',  prefix: 'SIL' },
  other:     { label: 'Otro',           prefix: 'EQP' },
}

export const EQUIPMENT_STATUS: Record<EquipmentStatus, { label: string; className: string }> = {
  available:   { label: 'Disponible',       className: 'bg-green-100 text-green-700' },
  assigned:    { label: 'Entregado',        className: 'bg-blue-100 text-blue-700' },
  maintenance: { label: 'En mantenimiento', className: 'bg-orange-100 text-orange-700' },
  lost:        { label: 'No devuelto',      className: 'bg-red-100 text-red-700' },
  retired:     { label: 'De baja',          className: 'bg-gray-100 text-gray-500' },
}

export const EQUIPMENT_CONDITION: Record<EquipmentCondition, { label: string; className: string; nextStatus: EquipmentStatus }> = {
  ok:      { label: 'Devuelto en buen estado', className: 'bg-green-100 text-green-700',   nextStatus: 'available' },
  damaged: { label: 'Devuelto dañado',         className: 'bg-orange-100 text-orange-700', nextStatus: 'maintenance' },
  missing: { label: 'No devuelto',             className: 'bg-red-100 text-red-700',       nextStatus: 'lost' },
}

export const EQUIPMENT_TYPE_KEYS   = Object.keys(EQUIPMENT_TYPES) as EquipmentType[]
export const EQUIPMENT_STATUS_KEYS = Object.keys(EQUIPMENT_STATUS) as EquipmentStatus[]

export function equipmentLabel(type: string, code: string, name?: string | null) {
  const t = EQUIPMENT_TYPES[type as EquipmentType]?.label ?? type
  return `${code} · ${name || t}`
}
