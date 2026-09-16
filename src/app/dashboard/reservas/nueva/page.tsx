// src/app/dashboard/reservas/nueva/page.tsx
// Carga los clientes del tenant en el servidor y los pasa al formulario cliente.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NuevaReservaForm from './NuevaReservaForm'

export default async function NuevaReservaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, id_number')
    .eq('tenant_id', profile.tenant_id)
    .order('full_name')

  return <NuevaReservaForm clients={clients ?? []} />
}
