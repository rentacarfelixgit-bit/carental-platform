'use server'

// src/app/dashboard/reservas/calendario/actions.ts
// Eventos de agenda del calendario: crear, editar, marcar como hecho y eliminar.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { EVENT_TYPE_KEYS } from '@/lib/calendarEvents'
import { rentalFolio } from '@/lib/rentalLabels'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) return null
  return { supabase, user, tenantId: profile.tenant_id as string }
}

function revalidateAgenda(reservationId?: string | null) {
  revalidatePath('/dashboard/reservas/calendario')
  revalidatePath('/dashboard')
  if (reservationId) revalidatePath(`/dashboard/reservas/${reservationId}`)
}

const EventSchema = z.object({
  id:             z.string().uuid().optional(),
  type:           z.enum(EVENT_TYPE_KEYS as [string, ...string[]]),
  title:          z.string().trim().min(1, 'Escribe un título').max(150),
  notes:          z.string().trim().max(2000).optional().transform(v => v || null),
  event_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  event_time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida').optional().or(z.literal('')).transform(v => v || null),
  reservation_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || null),
})

export type SaveEventResult = { error?: string; success?: boolean }

export async function saveCalendarEvent(input: z.input<typeof EventSchema>): Promise<SaveEventResult> {
  const parsed = EventSchema.safeParse(input)
  if (!parsed.success) {
    return { error: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos' }
  }
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const { id, ...data } = parsed.data

  // La renta ligada debe ser del mismo tenant
  if (data.reservation_id) {
    const { data: r } = await ctx.supabase
      .from('reservations').select('id')
      .eq('id', data.reservation_id).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!r) return { error: 'La renta seleccionada no existe' }
  }

  if (id) {
    const { data: prev } = await ctx.supabase
      .from('calendar_events').select('reservation_id')
      .eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!prev) return { error: 'Evento no encontrado' }

    const { error } = await ctx.supabase
      .from('calendar_events')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', ctx.tenantId)
    if (error) return { error: error.message }
    revalidateAgenda(prev.reservation_id)
  } else {
    const { error } = await ctx.supabase
      .from('calendar_events')
      .insert({ ...data, tenant_id: ctx.tenantId, created_by: ctx.user.id })
    if (error) return { error: error.message }
  }

  revalidateAgenda(data.reservation_id)
  return { success: true }
}

export async function setCalendarEventDone(id: string, done: boolean): Promise<SaveEventResult> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const { data, error } = await ctx.supabase
    .from('calendar_events')
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? ctx.user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).eq('tenant_id', ctx.tenantId)
    .select('reservation_id').maybeSingle()
  if (error) return { error: error.message }
  revalidateAgenda(data?.reservation_id)
  return { success: true }
}

export async function deleteCalendarEvent(id: string): Promise<SaveEventResult> {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  const { data } = await ctx.supabase
    .from('calendar_events').select('reservation_id')
    .eq('id', id).eq('tenant_id', ctx.tenantId).maybeSingle()
  const { error } = await ctx.supabase
    .from('calendar_events').delete().eq('id', id).eq('tenant_id', ctx.tenantId)
  if (error) return { error: error.message }
  revalidateAgenda(data?.reservation_id)
  return { success: true }
}

/** Rentas que se pueden ligar a un evento: abiertas (pendiente / confirmada / en curso). */
export async function listRentalsForEvents(): Promise<{ id: string; label: string }[]> {
  const ctx = await getContext()
  if (!ctx) return []
  const { data } = await ctx.supabase
    .from('reservations')
    .select('id, number, origin, start_date, end_date, clients ( full_name ), vehicles ( brand, model, plates )')
    .eq('tenant_id', ctx.tenantId)
    .in('status', ['pending', 'confirmed', 'active'])
    .order('start_date', { ascending: true })
    .limit(200)

  return (data ?? []).map(r => {
    const c = r.clients  as unknown as { full_name: string } | null
    const v = r.vehicles as unknown as { brand: string; model: string; plates: string } | null
    return {
      id: r.id,
      label: [rentalFolio(r.origin, r.number), c?.full_name, v ? `${v.brand} ${v.model} ${v.plates}` : null]
        .filter(Boolean).join(' · '),
    }
  })
}
