// src/app/dashboard/reservas/nueva/loadFormData.ts
// Datos que necesita el formulario de renta (Nueva reserva y Nuevo contrato):
// clientes del tenant, precios por defecto y zona horaria.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getReservationPrices } from '@/lib/reservationPrices'

export async function loadRentalFormData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  const [{ data: clients, error: clientsError }, { data: tenant }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, full_name, id_number, phone, email, license_number, license_expiry, passport_number, passport_expiry, address, city, state, zip_code')
      .eq('tenant_id', profile.tenant_id)
      .order('full_name'),
    supabase
      .from('tenants').select('settings, timezone').eq('id', profile.tenant_id).single(),
  ])

  if (clientsError) console.error('[renta/nueva] Error cargando clientes:', clientsError)

  return {
    clients:       clients ?? [],
    defaultPrices: getReservationPrices(tenant?.settings),
    timezone:      (tenant?.timezone as string | undefined) ?? 'UTC',
  }
}

/** Fecha/hora actual en la zona del negocio, en formato datetime-local (YYYY-MM-DDTHH:MM) */
export function nowInTimezone(timezone: string) {
  // sv-SE produce "YYYY-MM-DD HH:MM:SS"
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return s.replace(' ', 'T').slice(0, 16)
}
