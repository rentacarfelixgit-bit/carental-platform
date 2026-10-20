// src/lib/audit.ts
// Textos legibles de la Auditoría: módulos, acciones, campos y valores.
// Los movimientos los registra la base de datos (supabase_auditoria_oct2026.sql → audit_events).

import { RESERVATION_STATUS, CONTRACT_STATUS } from './rentalLabels'
import { EQUIPMENT_TYPES, EQUIPMENT_STATUS, EQUIPMENT_CONDITION } from './equipment'
import { EVENT_TYPES } from './calendarEvents'
import { ANGLE_LABELS } from './photoAngles'
import { fmtUSD } from './currency'

export type AuditAction = 'create' | 'update' | 'delete' | 'status'

export interface AuditEvent {
  id: number
  occurred_at: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  action: AuditAction
  table_name: string
  record_id: string | null
  record_label: string | null
  parent_table: string | null
  parent_id: string | null
  changes: Record<string, { old?: unknown; new?: unknown }>
  source: string | null
  ip: string | null
  user_agent: string | null
}

export const AUDIT_ACTIONS: Record<AuditAction, { label: string; className: string }> = {
  create: { label: 'Creó',            className: 'bg-green-100 text-green-700' },
  update: { label: 'Modificó',        className: 'bg-blue-100 text-blue-700' },
  status: { label: 'Cambió estado',   className: 'bg-purple-100 text-purple-700' },
  delete: { label: 'Eliminó',         className: 'bg-red-100 text-red-700' },
}

/** Módulos (tablas) en el orden en que aparecen en el filtro */
export const AUDIT_TABLES: Record<string, string> = {
  reservations:               'Reservas y contratos',
  reservation_changes:        'Cambios de fecha',
  reservation_vehicle_swaps:  'Cambios de vehículo',
  reservation_extras:         'Extras de renta',
  contracts:                  'Contratos impresos',
  inspections:                'Inspecciones',
  inspection_photos:          'Fotos de inspección',
  inspection_damage_points:   'Daños de inspección',
  rental_charges:             'Cargos adicionales',
  rental_equipment:           'Equipo en renta',
  clients:                    'Clientes',
  client_blacklist:           'Lista negra',
  vehicles:                   'Flotilla',
  vehicle_photos:             'Fotos de vehículos',
  vehicle_blocks:             'Bloqueos de vehículo',
  vehicle_maintenance_alerts: 'Mantenimiento',
  equipment_items:            'Inventario de equipo',
  calendar_events:            'Calendario',
  users:                      'Usuarios',
  tenants:                    'Configuración',
  tenant_features:            'Funciones del sistema',
}
export const tableLabel = (t: string) => AUDIT_TABLES[t] ?? t

/** Pantalla donde se puede abrir el registro */
export function recordHref(table: string, id: string | null): string | null {
  if (!id) return null
  if (table === 'reservations') return `/dashboard/reservas/${id}`
  if (table === 'clients')      return `/dashboard/clientes/${id}/editar`
  if (table === 'vehicles')     return `/dashboard/flota/${id}/editar`
  return null
}

const FIELD_LABELS: Record<string, string> = {
  // generales
  status: 'Estado', notes: 'Observaciones', internal_notes: 'Notas internas', active: 'Activo',
  description: 'Descripción', name: 'Nombre', title: 'Título', type: 'Tipo', reason: 'Motivo',
  // rentas
  number: 'Folio', origin: 'Tipo de renta', start_date: 'Salida', end_date: 'Regreso',
  total_amount: 'Total', daily_rate: 'Tarifa por día', payment_method: 'Forma de pago',
  cash_payment: 'Abono en efectivo', card_payment: 'Abono con tarjeta',
  cash_payment_currency: 'Moneda del abono en efectivo', card_payment_currency: 'Moneda del abono con tarjeta',
  exchange_rate: 'Tasa de cambio', price_breakdown: 'Desglose de precios', deposit: 'Depósito',
  discount: 'Descuento', folio: 'Folio del depósito', approval_number: 'Número de aprobación',
  prepared_by: 'Preparado por', driver_age: 'Edad del conductor', client_has_pets: 'Mascotas',
  insurance_deductible: 'Deducible del seguro',
  additional_driver_license: 'Conductor 1 · licencia', additional_driver_phone: 'Conductor 1 · teléfono',
  additional_driver2_license: 'Conductor 2 · licencia', additional_driver2_phone: 'Conductor 2 · teléfono',
  insurance_cdw_accepted: 'CDW aceptado', insurance_cdw_price: 'Precio CDW',
  insurance_lia_accepted: 'Liability aceptado', insurance_lia_price: 'Precio Liability',
  insurance_tw_accepted: 'Gomas y cristales aceptado', insurance_tw_price: 'Precio gomas y cristales',
  insurance_at_accepted: 'Anti-robo aceptado', insurance_at_price: 'Precio anti-robo',
  vehicle_id: 'Vehículo', client_id: 'Cliente', reservation_id: 'Renta', confirmed_by: 'Confirmada por',
  confirmed_at: 'Confirmada el', created_by: 'Creado por',
  // clientes
  full_name: 'Nombre', phone: 'Teléfono', email: 'Correo', id_type: 'Tipo de identificación',
  id_number: 'Identificación', license_number: 'Licencia', license_expiry: 'Vence licencia',
  passport_number: 'Pasaporte', passport_expiry: 'Vence pasaporte', address: 'Dirección', city: 'Ciudad',
  state: 'Estado / Provincia', zip_code: 'Código postal', local_phone: 'Teléfono local', local_address: 'Dirección local',
  // flotilla
  plates: 'Placas', brand: 'Marca', model: 'Modelo', year: 'Año', color: 'Color', vin: 'VIN',
  insurance_expiry: 'Vence seguro', permit_expiry: 'Vence permiso', status_locked: 'Estado fijado',
  // inspecciones
  odometer: 'Kilometraje', fuel_level: 'Combustible', storage_path: 'Archivo', angle: 'Ángulo',
  inspector_id: 'Inspector', swap_id: 'Cambio de vehículo',
  // equipo / cargos
  code: 'Código', amount: 'Monto', concept: 'Concepto', photo_paths: 'Fotos', return_condition: 'Estado al regresar',
  return_notes: 'Notas de regreso', assigned_at: 'Entregado', returned_at: 'Devuelto',
  // calendario
  event_date: 'Fecha', event_time: 'Hora', done: 'Hecho', done_at: 'Hecho el', done_by: 'Hecho por',
  // cambios de fecha / vehículo
  old_end_date: 'Regreso anterior', new_end_date: 'Regreso nuevo', old_total: 'Total anterior',
  suggested_total: 'Total sugerido', new_total: 'Total nuevo', keep_price: 'Sin cambiar precio',
  days_used: 'Días usados', days_remaining: 'Días restantes',
  // usuarios
  role: 'Rol', deleted_at: 'Eliminado el',
  // configuración
  'settings.reservation_prices': 'Precios por defecto',
  'settings.price_catalog': 'Conceptos (seguros, extras, impuestos)',
  'settings.currency': 'Moneda y tasa de cambio',
  timezone: 'Zona horaria',
}

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  if (field.startsWith('settings.')) return `Configuración · ${field.slice(9).replace(/_/g, ' ')}`
  return field.replace(/_/g, ' ')
}

const MONEY_FIELDS = new Set([
  'total_amount', 'daily_rate', 'deposit', 'discount', 'insurance_deductible', 'amount',
  'old_total', 'suggested_total', 'new_total', 'insurance_cdw_price', 'insurance_lia_price',
  'insurance_tw_price', 'insurance_at_price',
])
const DATE_FIELDS = /(_date|_at|_expiry)$/
const ROLE_LABELS: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', operator: 'Operador' }
const VEHICLE_STATUS: Record<string, string> = {
  available: 'Disponible', reserved: 'Reservado', in_use: 'En uso', maintenance: 'Mantenimiento', retained: 'Retenido',
}
const FUEL: Record<string, string> = { full: 'Lleno', three_quarters: '3/4', half: '1/2', quarter: '1/4', empty: 'Vacío' }
const PAYMENT: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', mixed: 'Efectivo y tarjeta' }

/** Valor legible de un campo (estado en español, dinero, fechas, sí/no…) */
export function formatValue(table: string, field: string, value: unknown, row?: AuditEvent): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (field === 'status' && typeof value === 'string') {
    if (table === 'reservations') {
      const origin = row?.record_label?.startsWith('C-') ? 'walk_in' : 'reservation'
      return (origin === 'walk_in' ? CONTRACT_STATUS[value] : RESERVATION_STATUS[value])?.label ?? value
    }
    if (table === 'vehicles') return VEHICLE_STATUS[value] ?? value
    if (table === 'equipment_items') return EQUIPMENT_STATUS[value as keyof typeof EQUIPMENT_STATUS]?.label ?? value
  }
  if (field === 'origin') return value === 'walk_in' ? 'Contrato de mostrador' : 'Reserva'
  if (field === 'role') return ROLE_LABELS[String(value)] ?? String(value)
  if (field === 'fuel_level') return FUEL[String(value)] ?? String(value)
  if (field === 'payment_method') return PAYMENT[String(value)] ?? String(value)
  if (field === 'angle') return ANGLE_LABELS[value as keyof typeof ANGLE_LABELS] ?? String(value)
  if (field === 'return_condition') return EQUIPMENT_CONDITION[value as keyof typeof EQUIPMENT_CONDITION]?.label ?? String(value)
  if (table === 'equipment_items' && field === 'type') return EQUIPMENT_TYPES[value as keyof typeof EQUIPMENT_TYPES]?.label ?? String(value)
  if (table === 'calendar_events' && field === 'type') return EVENT_TYPES[value as keyof typeof EVENT_TYPES]?.label ?? String(value)
  if (MONEY_FIELDS.has(field) && Number.isFinite(Number(value))) return fmtUSD(Number(value))
  if (typeof value === 'string' && DATE_FIELDS.test(field) && !Number.isNaN(Date.parse(value))) {
    return value.length <= 10
      ? new Date(`${value}T12:00:00`).toLocaleDateString('es-MX')
      : new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  }
  if (field === 'price_breakdown' && typeof value === 'object') {
    const b = value as { total?: number; lines?: { checked?: boolean; label?: string }[] }
    const chosen = (b.lines ?? []).filter(l => l.checked).map(l => l.label).filter(Boolean)
    return `Total ${fmtUSD(b.total ?? 0)}${chosen.length ? ` · ${chosen.join(', ')}` : ''}`
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value)
    return s.length > 160 ? `${s.slice(0, 160)}…` : s
  }
  const s = String(value)
  return s.length > 160 ? `${s.slice(0, 160)}…` : s
}

/** Campos técnicos que no vale la pena mostrar en la lista (sí salen en el CSV) */
export const HIDDEN_FIELDS = new Set(['tenant_id', 'id', 'storage_path_thumb'])

/** Campos que suelen indicar un movimiento sensible (para resaltarlos) */
export const SENSITIVE_FIELDS = new Set([
  'total_amount', 'daily_rate', 'discount', 'cash_payment', 'card_payment', 'exchange_rate',
  'price_breakdown', 'status', 'end_date', 'amount', 'role', 'active',
  'settings.reservation_prices', 'settings.currency', 'settings.price_catalog',
])
