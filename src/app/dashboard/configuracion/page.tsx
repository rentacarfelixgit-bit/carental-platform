import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BusinessForm from './BusinessForm'
import VehicleRatesForm from './VehicleRatesForm'
import TaxForm from './TaxForm'
import ReservationPricesForm from './ReservationPricesForm'
import { getReservationPrices, getPriceCatalog, getHiddenKeys, getDeletedKeys } from '@/lib/reservationPrices'
import ConfigTabs, { type ConfigTabId } from './ConfigTabs'
import CurrencyForm from './CurrencyForm'
import { getCurrencySettings } from '@/lib/currency'

// Definido aquí (no en ConfigTabs) porque los valores exportados de un módulo 'use client'
// no se pueden usar directamente en un Server Component.
const CONFIG_TAB_IDS: ConfigTabId[] = ['negocio', 'moneda', 'impuestos', 'precios', 'tarifas']

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function ConfiguracionPage({ searchParams }: Props) {
  const { tab } = await searchParams
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
  const reservationPrices = getReservationPrices(tenant?.settings)
  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin'

  const vehicleCount = vehicles?.length ?? 0
  const initialTab: ConfigTabId = CONFIG_TAB_IDS.includes(tab as ConfigTabId) ? (tab as ConfigTabId) : 'negocio'

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Datos del negocio, moneda, impuestos, precios y tarifas de la flota</p>
      </div>

      <ConfigTabs
        initialTab={initialTab}
        tabs={[
          {
            id: 'negocio',
            label: 'Datos del negocio',
            description: 'Información de la empresa que aparece en contratos y documentos.',
            icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
            content: <BusinessForm settings={settings} tenantName={tenant?.name ?? ''} timezone={tenant?.timezone ?? 'UTC'} />,
          },
          {
            id: 'moneda',
            label: 'Moneda y tasa de cambio',
            description: 'Los precios van siempre en US$. Aquí defines la moneda local y la tasa para mostrar el total equivalente.',
            icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            content: <CurrencyForm currency={getCurrencySettings(tenant?.settings)} canEdit={isAdmin} />,
          },
          {
            id: 'impuestos',
            label: 'Impuestos y cargos',
            description: 'Activa los impuestos que aplican. Se calculan sobre el subtotal y se muestran en el contrato.',
            icon: 'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
            content: <TaxForm settings={settings} />,
          },
          {
            id: 'precios',
            label: 'Precios de seguros, extras e impuestos',
            description: 'Precios por defecto (US$) que se precargan en cada renta. Agrega tus propios seguros, extras o impuestos, u oculta los que no uses.',
            icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
            content: <ReservationPricesForm items={getPriceCatalog(tenant?.settings, { includeHidden: true }).all} hidden={getHiddenKeys(tenant?.settings)} deleted={getDeletedKeys(tenant?.settings)} prices={reservationPrices} canEdit={isAdmin} />,
          },
          {
            id: 'tarifas',
            label: 'Tarifas por vehículo',
            description: 'La tarifa por día se sugiere automáticamente al crear una reserva.',
            icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
            badge: `${vehicleCount} vehículo${vehicleCount !== 1 ? 's' : ''}`,
            content: <VehicleRatesForm vehicles={vehicles ?? []} />,
          },
        ]}
      />
    </div>
  )
}
