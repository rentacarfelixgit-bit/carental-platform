import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, tenant_id')
    .eq('id', user!.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario'

  // Leer timezone del tenant para calcular "hoy" en la zona local del negocio
  const { data: tenant } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', profile!.tenant_id)
    .single()

  const tenantTz = tenant?.timezone ?? 'UTC'

  // Calcular "hoy" y "mañana" en la zona horaria del tenant
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: tenantTz }) // sv-SE da YYYY-MM-DD
  const todayStr    = fmt.format(now)
  const tomorrowDt  = new Date(now)
  tomorrowDt.setDate(tomorrowDt.getDate() + 1)
  const tomorrowStr = fmt.format(tomorrowDt)

  // Primer día del mes en la zona del tenant
  const firstOfMonthStr = fmt.format(new Date(now.getFullYear(), now.getMonth(), 1))
  const firstOfMonth = firstOfMonthStr + 'T00:00:00'

  // Conteos para las tarjetas
  const [
    { count: totalVehiculos },
    { count: reservasActivas },
    { count: totalClientes },
    { count: contratosEsteMes },
  ] = await Promise.all([
    supabase.from('vehicles').select('*', { count: 'exact', head: true }).neq('status', 'maintenance'),
    supabase.from('reservations').select('*', { count: 'exact', head: true })
      .lte('start_date', todayStr)
      .gte('end_date', todayStr)
      .in('status', ['pending', 'confirmed', 'active']),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('reservations').select('*', { count: 'exact', head: true })
      .gte('created_at', firstOfMonth)
      .neq('status', 'cancelled'),
  ])

  // Reservas que salen hoy
  const { data: salidasHoy } = await supabase
    .from('reservations')
    .select('id, start_date, end_date, clients(full_name), vehicles(brand, model, plates)')
    .gte('start_date', todayStr)
    .lt('start_date', tomorrowStr)
    .in('status', ['pending', 'confirmed', 'active'])
    .order('start_date')
    .limit(5)

  // Reservas que regresan hoy
  const { data: retornosHoy } = await supabase
    .from('reservations')
    .select('id, start_date, end_date, clients(full_name), vehicles(brand, model, plates)')
    .gte('end_date', todayStr)
    .lt('end_date', tomorrowStr)
    .in('status', ['pending', 'confirmed', 'active'])
    .order('end_date')
    .limit(5)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Bienvenido, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-1">Aquí tienes un resumen de la operación.</p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Vehículos disponibles"
          value={totalVehiculos ?? 0}
          icon="car"
          href="/dashboard/flota"
          color="blue"
        />
        <StatCard
          label="Reservas activas hoy"
          value={reservasActivas ?? 0}
          icon="calendar"
          href="/dashboard/reservas"
          color="green"
        />
        <StatCard
          label="Clientes registrados"
          value={totalClientes ?? 0}
          icon="users"
          href="/dashboard/clientes"
          color="purple"
        />
        <StatCard
          label="Contratos este mes"
          value={contratosEsteMes ?? 0}
          icon="document"
          href="/dashboard/reservas"
          color="orange"
        />
      </div>

      {/* Actividad de hoy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salidas hoy */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Salidas hoy</h2>
            <Link href="/dashboard/reservas" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          {salidasHoy && salidasHoy.length > 0 ? (
            <ul className="space-y-3">
              {salidasHoy.map((r: any) => (
                <li key={r.id}>
                  <Link href={`/dashboard/reservas/${r.id}`} className="flex items-center gap-3 group">
                    <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">
                        {r.clients?.full_name ?? 'Cliente'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {r.vehicles?.brand} {r.vehicles?.model} · {r.vehicles?.plates}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">hasta {r.end_date?.split('T')[0]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No hay salidas programadas para hoy.</p>
          )}
        </div>

        {/* Retornos hoy */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Retornos hoy</h2>
            <Link href="/dashboard/reservas" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          {retornosHoy && retornosHoy.length > 0 ? (
            <ul className="space-y-3">
              {retornosHoy.map((r: any) => (
                <li key={r.id}>
                  <Link href={`/dashboard/reservas/${r.id}`} className="flex items-center gap-3 group">
                    <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">
                        {r.clients?.full_name ?? 'Cliente'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {r.vehicles?.brand} {r.vehicles?.model} · {r.vehicles?.plates}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">desde {r.start_date?.split('T')[0]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No hay retornos programados para hoy.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  href,
  color,
}: {
  label: string
  value: number
  icon: 'car' | 'calendar' | 'users' | 'document'
  href: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const icons = {
    car: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    document: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  }

  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow block">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          {icons[icon]}
        </span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Link>
  )
}
