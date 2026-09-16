import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BusinessForm from './BusinessForm'
import VehicleRatesForm from './VehicleRatesForm'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, timezone, settings')
    .eq('id', profile.tenant_id)
    .single()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, plates, daily_rate')
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)
    .order('brand')

  const settings = (tenant?.settings as Record<string, string>) ?? {}

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Datos del negocio y tarifas de la flota</p>
      </div>

      {/* ── Datos del negocio ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
          Datos del negocio
        </h2>
        <BusinessForm settings={settings} tenantName={tenant?.name ?? ''} timezone={tenant?.timezone ?? 'UTC'} />
      </section>

      {/* ── Tarifas por vehículo ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-200">
          Tarifas por vehículo
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          La tarifa por día se sugiere automáticamente al crear una reserva.
        </p>
        <VehicleRatesForm vehicles={vehicles ?? []} />
      </section>
    </div>
  )
}
