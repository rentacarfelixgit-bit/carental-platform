'use server'

// src/app/dashboard/clientes/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const ClientSchema = z.object({
  full_name:      z.string().min(1, 'El nombre es requerido'),
  id_type:        z.enum(['passport', 'license']),
  id_number:      z.string().min(1, 'El número de identificación es requerido'),
  phone:          z.string().optional(),
  email:          z.string().email('Email inválido').optional().or(z.literal('')),
  license_number: z.string().optional(),
  license_expiry: z.string().optional(),
  notes:          z.string().optional(),
})

export type ClientFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id) return null
  return { supabase, user, tenantId: profile.tenant_id, role: profile.role }
}

// ── Crear cliente ─────────────────────────────────────────────────────────────

export async function createClient_(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  const { error } = await ctx.supabase.from('clients').insert({
    ...parsed.data,
    tenant_id:      ctx.tenantId,
    created_by:     ctx.user.id,
    updated_at:     new Date().toISOString(),
    phone:          parsed.data.phone          || null,
    email:          parsed.data.email          || null,
    license_number: parsed.data.license_number || null,
    license_expiry: parsed.data.license_expiry || null,
    notes:          parsed.data.notes          || null,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un cliente con ese número de identificación.' }
    return { error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true }
}

// ── Actualizar cliente ────────────────────────────────────────────────────────

export async function updateClient(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  const { error } = await ctx.supabase
    .from('clients')
    .update({
      ...parsed.data,
      updated_at:     new Date().toISOString(),
      phone:          parsed.data.phone          || null,
      email:          parsed.data.email          || null,
      license_number: parsed.data.license_number || null,
      license_expiry: parsed.data.license_expiry || null,
      notes:          parsed.data.notes          || null,
    })
    .eq('id', clientId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/clientes')
  redirect('/dashboard/clientes')
}

// ── Lista negra: agregar ──────────────────────────────────────────────────────

export async function addToBlacklist(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const reason = (formData.get('reason') as string)?.trim()
  if (!reason) return { fieldErrors: { reason: ['El motivo es requerido'] } }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  if (ctx.role !== 'admin') return { error: 'Solo los administradores pueden gestionar la lista negra.' }

  const { error } = await ctx.supabase.from('client_blacklist').insert({
    client_id: clientId,
    tenant_id: ctx.tenantId,
    reason,
    added_by:  ctx.user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clientes/${clientId}/editar`)
  revalidatePath('/dashboard/clientes')
  return { success: true }
}

// ── Lista negra: retirar ──────────────────────────────────────────────────────

export async function removeFromBlacklist(blacklistId: string, clientId: string) {
  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }
  if (ctx.role !== 'admin') return { error: 'No autorizado' }

  const { error } = await ctx.supabase
    .from('client_blacklist')
    .update({
      active:      false,
      removed_by:  ctx.user.id,
      removed_at:  new Date().toISOString(),
    })
    .eq('id', blacklistId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clientes/${clientId}/editar`)
  revalidatePath('/dashboard/clientes')
  return { success: true }
}
