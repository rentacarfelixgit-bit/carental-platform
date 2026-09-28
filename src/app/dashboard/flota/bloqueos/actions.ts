'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBlock(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile) return { error: 'Sin perfil' }

  const vehicleId = formData.get('vehicle_id')?.toString()
  const reason    = formData.get('reason')?.toString()
  const startDate = formData.get('start_date')?.toString()
  const endDate   = formData.get('end_date')?.toString()
  const notes     = formData.get('notes')?.toString() ?? null

  if (!vehicleId || !reason || !startDate || !endDate)
    return { error: 'Completa todos los campos requeridos' }

  if (new Date(endDate) <= new Date(startDate))
    return { error: 'La fecha de fin debe ser posterior a la de inicio' }

  const { error } = await supabase.from('vehicle_blocks').insert({
    tenant_id:  profile.tenant_id,
    vehicle_id: vehicleId,
    reason,
    notes,
    start_date: new Date(startDate).toISOString(),
    end_date:   new Date(endDate).toISOString(),
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/flota/bloqueos')
  return { success: true }
}

export async function deleteBlock(blockId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('vehicle_blocks')
    .delete()
    .eq('id', blockId)
    .eq('tenant_id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/flota/bloqueos')
  return { success: true }
}
