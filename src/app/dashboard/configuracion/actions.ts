'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Guardar datos del negocio ────────────────────────────────────────────────
export async function saveBusinessData(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const settings = {
    company_name: formData.get('company_name')?.toString().trim() ?? '',
    address:      formData.get('address')?.toString().trim() ?? '',
    city:         formData.get('city')?.toString().trim() ?? '',
    phone:        formData.get('phone')?.toString().trim() ?? '',
    phone_2:      formData.get('phone_2')?.toString().trim() ?? '',
    email:        formData.get('email')?.toString().trim() ?? '',
    email_2:      formData.get('email_2')?.toString().trim() ?? '',
    rnc:          formData.get('rnc')?.toString().trim() ?? '',
  }

  const { error } = await supabase
    .from('tenants')
    .update({ settings })
    .eq('id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}

// ── Guardar tarifa de un vehículo ────────────────────────────────────────────
export async function saveVehicleRate(vehicleId: string, dailyRate: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin'))
    return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('vehicles')
    .update({ daily_rate: dailyRate })
    .eq('id', vehicleId)
    .eq('tenant_id', profile.tenant_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/configuracion')
  return { success: true }
}
