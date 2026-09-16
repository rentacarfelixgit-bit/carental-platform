'use server'

// src/app/dashboard/admin/limpieza/actions.ts

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAdminContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id || profile.role !== 'admin') return null
  return { supabase, tenantId: profile.tenant_id }
}

export interface CleanupPreview {
  photoCount: number
  reservationCount: number
  cutoffDate: string
}

export interface CleanupResult {
  deleted: number
  error?: string
}

// Devuelve cuántas fotos se eliminarían con el criterio dado
export async function previewCleanup(months: number): Promise<CleanupPreview | { error: string }> {
  const ctx = await getAdminContext()
  if (!ctx) return { error: 'No autorizado' }

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffIso = cutoff.toISOString()

  // Fotos de inspecciones de reservas completadas/canceladas antes del cutoff
  const { data, error } = await ctx.supabase
    .from('inspection_photos')
    .select(`
      id,
      inspections!inner (
        reservation_id,
        reservations!inner ( status, end_date )
      )
    `)
    .eq('tenant_id', ctx.tenantId)
    .lt('inspections.reservations.end_date', cutoffIso)
    .in('inspections.reservations.status', ['completed', 'cancelled'])

  if (error) return { error: error.message }

  const reservationIds = new Set(
    (data ?? []).map((p) => {
      const insp = p.inspections as unknown as { reservation_id: string }
      return insp?.reservation_id
    }).filter(Boolean)
  )

  return {
    photoCount: data?.length ?? 0,
    reservationCount: reservationIds.size,
    cutoffDate: cutoff.toLocaleDateString('es-MX'),
  }
}

// Elimina las fotos del bucket y de la tabla
export async function executeCleanup(months: number): Promise<CleanupResult> {
  const ctx = await getAdminContext()
  if (!ctx) return { deleted: 0, error: 'No autorizado' }

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffIso = cutoff.toISOString()

  // Obtener fotos a eliminar con sus paths
  const { data, error } = await ctx.supabase
    .from('inspection_photos')
    .select(`
      id, storage_path,
      inspections!inner (
        reservations!inner ( status, end_date )
      )
    `)
    .eq('tenant_id', ctx.tenantId)
    .lt('inspections.reservations.end_date', cutoffIso)
    .in('inspections.reservations.status', ['completed', 'cancelled'])

  if (error) return { deleted: 0, error: error.message }
  if (!data || data.length === 0) return { deleted: 0 }

  const ids    = data.map(p => p.id)
  const paths  = data.map(p => p.storage_path).filter(Boolean) as string[]

  // 1. Eliminar del bucket en lotes de 100 (límite de Supabase Storage)
  const BATCH = 100
  for (let i = 0; i < paths.length; i += BATCH) {
    await ctx.supabase.storage
      .from('inspection-photos')
      .remove(paths.slice(i, i + BATCH))
  }

  // 2. Eliminar registros de la tabla
  const { error: dbError } = await ctx.supabase
    .from('inspection_photos')
    .delete()
    .in('id', ids)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return { deleted: paths.length, error: `Fotos eliminadas del bucket pero error en BD: ${dbError.message}` }

  revalidatePath('/dashboard/admin/limpieza')
  return { deleted: paths.length }
}
