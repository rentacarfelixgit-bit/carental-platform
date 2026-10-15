'use server'

// src/app/dashboard/equipo/actions.ts
// Inventario de equipo: catálogo, entrega en rentas, devolución y cargos adicionales.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  EQUIPMENT_TYPE_KEYS, EQUIPMENT_CONDITION, EQUIPMENT_TYPES,
  type EquipmentCondition, type EquipmentType,
} from '@/lib/equipment'

type Result = { error?: string; success?: boolean }

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) return null
  return {
    supabase, user, tenantId: profile.tenant_id as string,
    isAdmin: profile.role === 'admin' || profile.role === 'superadmin',
  }
}
type Ctx = NonNullable<Awaited<ReturnType<typeof getContext>>>

function revalidateRental(reservationId?: string | null) {
  revalidatePath('/dashboard/equipo')
  revalidatePath('/dashboard/reservas/calendario')
  revalidatePath('/dashboard')
  if (reservationId) {
    revalidatePath(`/dashboard/reservas/${reservationId}`)
    revalidatePath(`/print/reservas/${reservationId}/contrato`)
  }
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  code:  z.string().trim().min(1, 'El código es requerido').max(30)
           .transform(v => v.toUpperCase())
           .refine(v => /^[A-Z0-9-]+$/.test(v), 'El código solo puede tener letras, números y guiones'),
  type:  z.enum(EQUIPMENT_TYPE_KEYS as [string, ...string[]]),
  name:  z.string().trim().max(100).optional().transform(v => v || null),
  notes: z.string().trim().max(1000).optional().transform(v => v || null),
})

export async function createEquipment(input: z.input<typeof ItemSchema>): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  if (!ctx.isAdmin) return { error: 'Solo un administrador puede dar de alta equipo' }
  const parsed = ItemSchema.safeParse(input)
  if (!parsed.success) return { error: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' }

  const { error } = await ctx.supabase.from('equipment_items').insert({
    ...parsed.data, tenant_id: ctx.tenantId, created_by: ctx.user.id,
  })
  if (error) {
    if (error.code === '23505') return { error: `Ya existe un equipo con el código ${parsed.data.code}` }
    return { error: error.message }
  }
  revalidatePath('/dashboard/equipo')
  return { success: true }
}

const UpdateSchema = z.object({
  name:   z.string().trim().max(100).optional().transform(v => v || null),
  notes:  z.string().trim().max(1000).optional().transform(v => v || null),
  // "Entregado" solo lo asigna el sistema al entregarlo en una renta
  status: z.enum(['available', 'maintenance', 'lost', 'retired']),
})

export async function updateEquipment(id: string, input: z.input<typeof UpdateSchema>): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  if (!ctx.isAdmin) return { error: 'Solo un administrador puede modificar equipo' }
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) return { error: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' }

  const { data: item } = await ctx.supabase
    .from('equipment_items').select('status').eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!item) return { error: 'Equipo no encontrado' }
  // Si está entregado, solo se pueden editar nombre y notas; el estado cambia al registrar la devolución
  const changes = item.status === 'assigned'
    ? { name: parsed.data.name, notes: parsed.data.notes }
    : parsed.data

  const { error } = await ctx.supabase.from('equipment_items')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', ctx.tenantId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/equipo')
  return { success: true }
}

/** Equipo disponible para entregar */
export async function listAvailableEquipment() {
  const ctx = await getContext()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .from('equipment_items')
    .select('id, code, type, name')
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'available')
    .order('type').order('code')
  return data ?? []
}

// ── Entrega en una renta ─────────────────────────────────────────────────────

export async function assignEquipment(reservationId: string, equipmentId: string): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  const [{ data: rental }, { data: item }] = await Promise.all([
    ctx.supabase.from('reservations').select('id, status, end_date')
      .eq('id', reservationId).eq('tenant_id', ctx.tenantId).maybeSingle(),
    ctx.supabase.from('equipment_items').select('id, code, type, name, status')
      .eq('id', equipmentId).eq('tenant_id', ctx.tenantId).maybeSingle(),
  ])
  if (!rental) return { error: 'Renta no encontrada' }
  if (!['pending', 'confirmed', 'active'].includes(rental.status)) return { error: 'La renta ya está cerrada o cancelada' }
  if (!item) return { error: 'Equipo no encontrado' }
  if (item.status !== 'available') return { error: `${item.code} no está disponible` }

  const { data: assignment, error } = await ctx.supabase.from('rental_equipment').insert({
    tenant_id: ctx.tenantId, reservation_id: reservationId, equipment_id: equipmentId, assigned_by: ctx.user.id,
  }).select('id').single()
  if (error || !assignment) {
    if (error?.code === '23505') return { error: `${item.code} ya está entregado en otra renta` }
    return { error: error?.message ?? 'No se pudo asignar' }
  }

  await ctx.supabase.from('equipment_items')
    .update({ status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', equipmentId).eq('tenant_id', ctx.tenantId)

  // Recordatorio en la agenda para el día del regreso
  const end = rental.end_date as string
  await ctx.supabase.from('calendar_events').insert({
    tenant_id: ctx.tenantId,
    type: 'equipment_return',
    title: `Recoger ${item.code}`,
    notes: `${item.name || EQUIPMENT_TYPES[item.type as EquipmentType]?.label || 'Equipo'} entregado al cliente.`,
    event_date: end.slice(0, 10),
    event_time: end.length >= 16 ? end.slice(11, 16) : null,
    reservation_id: reservationId,
    rental_equipment_id: assignment.id,
    created_by: ctx.user.id,
  })

  revalidateRental(reservationId)
  return { success: true }
}

/** Quitar un equipo asignado por error (solo si el vehículo aún no se entrega) */
export async function unassignEquipment(rentalEquipmentId: string): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const { data: row } = await ctx.supabase
    .from('rental_equipment')
    .select('id, equipment_id, reservation_id, returned_at, reservations ( status )')
    .eq('id', rentalEquipmentId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!row) return { error: 'No encontrado' }
  if (row.returned_at) return { error: 'Este equipo ya fue devuelto' }
  const status = (row.reservations as unknown as { status: string } | null)?.status
  if (status === 'active') return { error: 'El vehículo ya se entregó; registra la devolución del equipo en lugar de quitarlo.' }

  await ctx.supabase.from('calendar_events').delete()
    .eq('rental_equipment_id', rentalEquipmentId).eq('tenant_id', ctx.tenantId)
  const { error } = await ctx.supabase.from('rental_equipment').delete()
    .eq('id', rentalEquipmentId).eq('tenant_id', ctx.tenantId)
  if (error) return { error: error.message }
  await ctx.supabase.from('equipment_items')
    .update({ status: 'available', updated_at: new Date().toISOString() })
    .eq('id', row.equipment_id).eq('tenant_id', ctx.tenantId)

  revalidateRental(row.reservation_id)
  return { success: true }
}

// ── Cargos ───────────────────────────────────────────────────────────────────

const ChargeSchema = z.object({
  concept:     z.string().trim().min(1, 'Escribe el concepto').max(150),
  amount:      z.coerce.number().min(0, 'Monto inválido').max(10_000_000),
  reason:      z.string().trim().min(3, 'Escribe el motivo del cargo').max(1000),
  photo_paths: z.array(z.string().min(1)).max(10).default([]),
})

async function insertCharge(ctx: Ctx, reservationId: string, input: z.input<typeof ChargeSchema>, rentalEquipmentId: string | null) {
  const parsed = ChargeSchema.safeParse(input)
  if (!parsed.success) return { error: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' }
  // Las fotos deben estar en la carpeta del tenant
  if (parsed.data.photo_paths.some(p => !p.startsWith(`${ctx.tenantId}/charges/`))) return { error: 'Foto inválida' }
  const { error } = await ctx.supabase.from('rental_charges').insert({
    tenant_id: ctx.tenantId,
    reservation_id: reservationId,
    rental_equipment_id: rentalEquipmentId,
    concept: parsed.data.concept,
    amount: Math.round(parsed.data.amount * 100) / 100,
    reason: parsed.data.reason,
    photo_paths: parsed.data.photo_paths,
    created_by: ctx.user.id,
  })
  return error ? { error: error.message } : {}
}

export async function addRentalCharge(reservationId: string, input: z.input<typeof ChargeSchema>): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const { data: rental } = await ctx.supabase.from('reservations').select('id')
    .eq('id', reservationId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!rental) return { error: 'Renta no encontrada' }
  const res = await insertCharge(ctx, reservationId, input, null)
  if (res.error) return res
  revalidateRental(reservationId)
  return { success: true }
}

// ── Devolución ───────────────────────────────────────────────────────────────

export async function returnEquipment(
  rentalEquipmentId: string,
  condition: EquipmentCondition,
  notes: string,
  charge?: { amount: number; reason: string; photo_paths: string[] } | null,
): Promise<Result> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  if (!EQUIPMENT_CONDITION[condition]) return { error: 'Condición inválida' }
  if (condition !== 'ok' && !notes.trim() && !charge) return { error: 'Describe qué pasó con el equipo' }

  const { data: row } = await ctx.supabase
    .from('rental_equipment')
    .select('id, reservation_id, equipment_id, returned_at, equipment_items ( code, type, name )')
    .eq('id', rentalEquipmentId).eq('tenant_id', ctx.tenantId).maybeSingle()
  if (!row) return { error: 'No encontrado' }
  if (row.returned_at) return { error: 'Este equipo ya tiene registrada su devolución' }
  const item = row.equipment_items as unknown as { code: string; type: string; name: string | null } | null

  // Primero el cargo (si falla, no se registra la devolución)
  if (charge) {
    const label = item ? `${item.name || EQUIPMENT_TYPES[item.type as EquipmentType]?.label || 'Equipo'} ${item.code}` : 'Equipo'
    const res = await insertCharge(ctx, row.reservation_id, {
      concept: `${label} — ${condition === 'missing' ? 'no devuelto' : 'dañado'}`,
      amount: charge.amount, reason: charge.reason, photo_paths: charge.photo_paths,
    }, rentalEquipmentId)
    if (res.error) return res
  }

  const now = new Date().toISOString()
  const { error } = await ctx.supabase.from('rental_equipment').update({
    returned_at: now, returned_by: ctx.user.id, return_condition: condition, return_notes: notes.trim() || null,
  }).eq('id', rentalEquipmentId).eq('tenant_id', ctx.tenantId)
  if (error) return { error: error.message }

  await Promise.all([
    ctx.supabase.from('equipment_items')
      .update({ status: EQUIPMENT_CONDITION[condition].nextStatus, updated_at: now })
      .eq('id', row.equipment_id).eq('tenant_id', ctx.tenantId),
    // El recordatorio de recolección queda como hecho
    ctx.supabase.from('calendar_events')
      .update({ done: true, done_at: now, done_by: ctx.user.id, updated_at: now })
      .eq('rental_equipment_id', rentalEquipmentId).eq('tenant_id', ctx.tenantId).eq('done', false),
  ])

  revalidateRental(row.reservation_id)
  return { success: true }
}
