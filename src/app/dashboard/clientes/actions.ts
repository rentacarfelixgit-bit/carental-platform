'use server'

// src/app/dashboard/clientes/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const ClientSchema = z.object({
  full_name:       z.string().trim().min(1, 'El nombre es requerido').max(150),
  phone_code:      z.string().optional(),
  phone:           z.string().trim().max(20).optional().transform(v => v || null),
  email:           z.string().trim().email('Email inválido').max(150).optional().or(z.literal('')).transform(v => v || null),
  license_number:  z.string().trim().max(30).optional().transform(v => v || null),
  license_expiry:  z.string().optional().transform(v => v || null),
  passport_number: z.string().trim().max(30).optional().transform(v => v || null),
  notes:           z.string().trim().max(2000).optional().transform(v => v || null),
})

export type ClientFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  values?: Record<string, string>
  success?: boolean
  /** Solo en createClientQuick — datos del cliente recién creado */
  newClient?: { id: string; full_name: string; id_number: string }
}

function getValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : ''])
  )
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
  const values = getValues(formData)
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values }

  const { license_number, passport_number } = parsed.data

  // Al menos un ID obligatorio
  if (!license_number && !passport_number) {
    return {
      error: 'Debes ingresar al menos un número de identificación (licencia o pasaporte).',
      values,
    }
  }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado', values }

  // Componer teléfono con lada
  const phone = parsed.data.phone
    ? `${parsed.data.phone_code ?? ''}${parsed.data.phone}`.trim() || null
    : null

  // Determinar id_type e id_number (para compatibilidad con columnas existentes)
  const id_type   = license_number ? 'license' : 'passport'
  const id_number = (license_number ?? passport_number)!

  // Verificar duplicado por licencia
  if (license_number) {
    const { data: existing } = await ctx.supabase
      .from('clients')
      .select('id, full_name')
      .eq('tenant_id', ctx.tenantId)
      .eq('license_number', license_number)
      .maybeSingle()
    if (existing) {
      return {
        error: `Ya existe un cliente con esa licencia: ${existing.full_name}.`,
        values,
      }
    }
  }

  // Verificar duplicado por pasaporte
  if (passport_number) {
    const { data: existing } = await ctx.supabase
      .from('clients')
      .select('id, full_name')
      .eq('tenant_id', ctx.tenantId)
      .eq('passport_number', passport_number)
      .maybeSingle()
    if (existing) {
      return {
        error: `Ya existe un cliente con ese pasaporte: ${existing.full_name}.`,
        values,
      }
    }
  }

  const { error } = await ctx.supabase.from('clients').insert({
    full_name:       parsed.data.full_name,
    id_type,
    id_number,
    phone,
    email:           parsed.data.email,
    license_number,
    license_expiry:  parsed.data.license_expiry,
    passport_number,
    notes:           parsed.data.notes,
    tenant_id:       ctx.tenantId,
    created_by:      ctx.user.id,
    updated_at:      new Date().toISOString(),
  })

  if (error) {
    if (error.code === '23505')
      return { error: 'Ya existe un cliente con ese número de identificación.', values }
    return { error: error.message, values }
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
  const values = getValues(formData)
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values }

  const { license_number, passport_number } = parsed.data

  if (!license_number && !passport_number) {
    return {
      error: 'Debes ingresar al menos un número de identificación (licencia o pasaporte).',
      values,
    }
  }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado', values }

  const phone = parsed.data.phone
    ? `${parsed.data.phone_code ?? ''}${parsed.data.phone}`.trim() || null
    : null

  // Verificar duplicado por licencia (excluyendo al cliente actual)
  if (license_number) {
    const { data: existing } = await ctx.supabase
      .from('clients')
      .select('id, full_name')
      .eq('tenant_id', ctx.tenantId)
      .eq('license_number', license_number)
      .neq('id', clientId)
      .maybeSingle()
    if (existing) {
      return {
        error: `Ya existe otro cliente con esa licencia: ${existing.full_name}.`,
        values,
      }
    }
  }

  // Verificar duplicado por pasaporte (excluyendo al cliente actual)
  if (passport_number) {
    const { data: existing } = await ctx.supabase
      .from('clients')
      .select('id, full_name')
      .eq('tenant_id', ctx.tenantId)
      .eq('passport_number', passport_number)
      .neq('id', clientId)
      .maybeSingle()
    if (existing) {
      return {
        error: `Ya existe otro cliente con ese pasaporte: ${existing.full_name}.`,
        values,
      }
    }
  }

  const id_type   = license_number ? 'license' : 'passport'
  const id_number = (license_number ?? passport_number)!

  const { error } = await ctx.supabase
    .from('clients')
    .update({
      full_name:       parsed.data.full_name,
      id_type,
      id_number,
      phone,
      email:           parsed.data.email,
      license_number,
      license_expiry:  parsed.data.license_expiry,
      passport_number,
      notes:           parsed.data.notes,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: error.message, values }

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

  // Verificar que no esté ya en lista negra
  const { data: existing } = await ctx.supabase
    .from('client_blacklist')
    .select('id')
    .eq('client_id', clientId)
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .maybeSingle()

  if (existing) return { error: 'Este cliente ya está en la lista negra.' }

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

// ── Guardar dirección del cliente (desde modal de contrato) ──────────────────

export async function saveClientAddress(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const clientId = (formData.get('client_id') as string)?.trim()
  // Si no hay cliente en la reserva, simplemente retornar éxito
  if (!clientId) return { success: true }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado' }

  const address      = (formData.get('address')       as string)?.trim() || null
  const city         = (formData.get('city')           as string)?.trim() || null
  const state_       = (formData.get('state')          as string)?.trim() || null
  const zip_code     = (formData.get('zip_code')       as string)?.trim() || null
  const local_phone  = (formData.get('local_phone')    as string)?.trim() || null
  const local_address = (formData.get('local_address') as string)?.trim() || null

  const { error } = await ctx.supabase
    .from('clients')
    .update({
      address,
      city,
      state: state_,
      zip_code,
      local_phone,
      local_address,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('tenant_id', ctx.tenantId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clientes/${clientId}`)
  return { success: true }
}

// ── Crear cliente rápido (desde modal en nueva reserva) ───────────────────────
// Igual que createClient_ pero devuelve los datos del cliente creado en vez de redirigir.

export async function createClientQuick(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const values = getValues(formData)
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values }

  const { license_number, passport_number } = parsed.data

  if (!license_number && !passport_number) {
    return {
      error: 'Debes ingresar al menos un número de identificación (licencia o pasaporte).',
      values,
    }
  }

  const ctx = await getContext()
  if (!ctx) return { error: 'No autorizado', values }

  const phone = parsed.data.phone
    ? `${parsed.data.phone_code ?? ''}${parsed.data.phone}`.trim() || null
    : null

  const id_type   = license_number ? 'license' : 'passport'
  const id_number = (license_number ?? passport_number)!

  if (license_number) {
    const { data: existing } = await ctx.supabase
      .from('clients').select('id, full_name')
      .eq('tenant_id', ctx.tenantId).eq('license_number', license_number).maybeSingle()
    if (existing) return { error: `Ya existe un cliente con esa licencia: ${existing.full_name}.`, values }
  }
  if (passport_number) {
    const { data: existing } = await ctx.supabase
      .from('clients').select('id, full_name')
      .eq('tenant_id', ctx.tenantId).eq('passport_number', passport_number).maybeSingle()
    if (existing) return { error: `Ya existe un cliente con ese pasaporte: ${existing.full_name}.`, values }
  }

  const { data: inserted, error } = await ctx.supabase
    .from('clients')
    .insert({
      full_name:       parsed.data.full_name,
      id_type,
      id_number,
      phone,
      email:           parsed.data.email,
      license_number,
      license_expiry:  parsed.data.license_expiry,
      passport_number,
      notes:           parsed.data.notes,
      tenant_id:       ctx.tenantId,
      created_by:      ctx.user.id,
      updated_at:      new Date().toISOString(),
    })
    .select('id, full_name, id_number')
    .single()

  if (error) {
    if (error.code === '23505')
      return { error: 'Ya existe un cliente con ese número de identificación.', values }
    return { error: error.message, values }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true, newClient: inserted }
}
