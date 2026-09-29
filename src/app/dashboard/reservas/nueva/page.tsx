// src/app/dashboard/reservas/nueva/page.tsx
// Carga los clientes del tenant en el servidor y los pasa al formulario cliente.
// Si viene desde el calendario, los params start/end/vehicle pre-llenan el form.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NuevaReservaForm from './NuevaReservaForm'

interface Props {
  searchParams: Promise<{ start?: string; end?: string; vehicle?: string }>
}

export default async function NuevaReservaPage({ searchParams }: Props) {
  const { start, end, vehicle } = await searchParams

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

  return (
    <NuevaReservaForm
      clients={clients ?? []}
      initialStartDate={start ?? ''}
      initialEndDate={end ?? ''}
      initialVehicleId={vehicle ?? ''}
    />
  )
}
