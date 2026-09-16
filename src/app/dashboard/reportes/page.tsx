// src/app/dashboard/reportes/page.tsx
// Reportes operativos — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const STATUS_VEHICLE_LABELS: Record<string, string> = {
  available:   'Disponibles',
  reserved:    'Reservados',
  in_use:      'En uso',
  maintenance: 'En mantenimiento',
  retained:    'Retenidos',
}

const STATUS_RES_LABELS: Record<string, string> = {
  pending:   'Pendientes',
  confirmed: 'Confirmadas',
  active:    'En curso',
  completed: 'Completadas',
  cancelled: 'Canceladas',
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  oil_change:           'Cambio de aceite',
  insurance_renewal:    'Renovación de seguro',
  tires:                'Llantas',
  technical_inspection: 'Revisión técnica',
  custom:               'Personalizada',
}

// Rango default: últimos 30 días
function defaultRange() {
  const end   = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 30)
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  }
}

interface Props {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

export default async function ReportesPage({ searchParams }: Props) {
  const defaults = defaultRange()
  const { desde = defaults.start, hasta = defaults.end } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id) redirect('/login')

  const tid = profile.tenant_id

  // ── Consultas en paralelo ────────────────────────────────────────────────────
  const [
    { data: vehiclesByStatus },
    { data: reservationsByStatus },
    { count: totalClients },
    { data: reservationsInPeriod },
    { data: fleetUtilization },
    { data: openAlerts },
  ] = await Promise.all([
    // Vehículos activos agrupados por estado
    supabase
      .from('vehicles')
      .select('status')
      .eq('tenant_id', tid)
      .eq('active', true),

    // Reservas agrupadas por estado (todas)
    supabase
      .from('reservations')
      .select('status')
      .eq('tenant_id', tid),

    // Total clientes
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid),

    // Reservas cuyo inicio cae dentro del período seleccionado
    supabase
      .from('reservations')
      .select(`
        id, status, start_date, end_date, created_at,
        clients ( full_name ),
        vehicles ( plates, brand, model )
      `)
      .eq('tenant_id', tid)
      .gte('start_date', `${desde}T00:00:00`)
      .lte('start_date', `${hasta}T23:59:59`)
      .order('start_date', { ascending: false })
      .limit(50),

    // Utilización de flota: reservas y días por vehículo
    supabase
      .from('vehicles')
      .select(`
        id, brand, model, plates, year,
        reservations ( id, start_date, end_date, status )
      `)
      .eq('tenant_id', tid)
      .eq('active', true),

    // Alertas de mantenimiento abiertas
    supabase
      .from('vehicle_maintenance_alerts')
      .select(`
        id, alert_type, description, due_date, due_km, created_at,
        vehicles ( id, brand, model, plates )
      `)
      .eq('tenant_id', tid)
      .eq('resolved', false)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  // Agrupar vehículos por estado
  const vehicleStatusCount: Record<string, number> = {}
  ;(vehiclesByStatus ?? []).forEach((v: { status: string }) => {
    vehicleStatusCount[v.status] = (vehicleStatusCount[v.status] ?? 0) + 1
  })

  // Agrupar reservas por estado
  const resStatusCount: Record<string, number> = {}
  ;(reservationsByStatus ?? []).forEach((r: { status: string }) => {
    resStatusCount[r.status] = (resStatusCount[r.status] ?? 0) + 1
  })

  const activeReservations = (resStatusCount.pending ?? 0) + (resStatusCount.confirmed ?? 0) + (resStatusCount.active ?? 0)

  // Calcular utilización de flota
  type VehicleRow = {
    id: string; brand: string; model: string; plates: string; year: number
    reservations: { id: string; start_date: string; end_date: string; status: string }[]
  }
  const utilization = (fleetUtilization as VehicleRow[] ?? []).map(v => {
    const completedReservations = v.reservations.filter(r => r.status !== 'cancelled')
    const totalDays = completedReservations.reduce((sum, r) => {
      const days = Math.ceil(
        (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      return sum + Math.max(0, days)
    }, 0)
    return {
      ...v,
      totalReservations: completedReservations.length,
      totalDays,
    }
  }).sort((a, b) => b.totalDays - a.totalDays)

  const STATUS_VEHICLE_COLORS: Record<string, string> = {
    available:   'bg-green-100 text-green-700',
    reserved:    'bg-blue-100 text-blue-700',
    in_use:      'bg-yellow-100 text-yellow-700',
    maintenance: 'bg-orange-100 text-orange-700',
    retained:    'bg-red-100 text-red-700',
  }

  const STATUS_RES_COLORS: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    active:    'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vista operativa en tiempo real</p>
        </div>
        <Link
          href="/dashboard/admin/limpieza"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Limpieza de storage
        </Link>
      </div>

      {/* ── 1. Resumen en tiempo real ─────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-4">Resumen actual</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total vehículos activos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Vehículos activos</p>
            <p className="text-2xl font-bold text-gray-900">
              {Object.values(vehicleStatusCount).reduce((s, n) => s + n, 0)}
            </p>
          </div>
          {/* Reservas activas */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Reservas vigentes</p>
            <p className="text-2xl font-bold text-blue-600">{activeReservations}</p>
          </div>
          {/* Total clientes */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Clientes</p>
            <p className="text-2xl font-bold text-gray-900">{totalClients ?? 0}</p>
          </div>
          {/* Alertas abiertas */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Alertas de mantenimiento</p>
            <p className={`text-2xl font-bold ${(openAlerts?.length ?? 0) > 0 ? 'text-orange-500' : 'text-gray-900'}`}>
              {openAlerts?.length ?? 0}
            </p>
          </div>
        </div>

        {/* Vehículos por estado */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(STATUS_VEHICLE_LABELS).map(([status, label]) => (
            <div key={status} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{vehicleStatusCount[status] ?? 0}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${STATUS_VEHICLE_COLORS[status]}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Reservas por estado */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(STATUS_RES_LABELS).map(([status, label]) => (
            <div key={status} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{resStatusCount[status] ?? 0}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${STATUS_RES_COLORS[status]}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. Reservas por período ───────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-medium text-gray-700">
            Reservas con salida en el período
            <span className="ml-2 text-gray-400 font-normal">({reservationsInPeriod?.length ?? 0} resultados)</span>
          </h2>
          <form method="GET" action="/dashboard/reportes" className="flex items-center gap-2">
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
              Filtrar
            </button>
          </form>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {reservationsInPeriod && reservationsInPeriod.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Vehículo</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Período</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservationsInPeriod.map((r) => {
                  const c = r.clients  as unknown as { full_name: string } | null
                  const v = r.vehicles as unknown as { plates: string; brand: string; model: string } | null
                  const nights = Math.ceil(
                    (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c?.full_name ?? '—'}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell text-gray-600">
                        {v?.brand} {v?.model}
                        <span className="text-xs text-gray-400 ml-1 font-mono">{v?.plates}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500">
                        {new Date(r.start_date).toLocaleDateString('es-MX')} · {nights}d
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_RES_COLORS[r.status]}`}>
                          {STATUS_RES_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/dashboard/reservas/${r.id}`} className="text-xs text-blue-600 hover:underline">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-10 text-sm text-gray-400">Sin reservas en ese período.</p>
          )}
        </div>
      </section>

      {/* ── 3. Utilización de flota ───────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 mb-4">Utilización de flota</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vehículo</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Placas</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Reservas</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Días rentados</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell w-40">Ocupación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {utilization.length > 0 ? utilization.map(v => {
                const maxDays = Math.max(...utilization.map(u => u.totalDays), 1)
                const pct = Math.round((v.totalDays / maxDays) * 100)
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.brand} {v.model} <span className="text-xs text-gray-400">{v.year}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.plates}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{v.totalReservations}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{v.totalDays}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Sin datos de flota.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. Alertas de mantenimiento abiertas ─────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700">
            Alertas de mantenimiento abiertas
            {(openAlerts?.length ?? 0) > 0 && (
              <span className="ml-2 text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                {openAlerts?.length}
              </span>
            )}
          </h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {openAlerts && openAlerts.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vehículo</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Tipo de alerta</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Vencimiento</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {openAlerts.map((a) => {
                  const v = a.vehicles as unknown as { brand: string; model: string; plates: string; id?: string } | null
                  const isOverdue = a.due_date && new Date(a.due_date) < new Date()
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{v?.brand} {v?.model}</p>
                        <p className="text-xs font-mono text-gray-400">{v?.plates}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {ALERT_TYPE_LABELS[a.alert_type] ?? a.alert_type}
                        {a.description && <span className="text-xs text-gray-400 ml-1">— {a.description}</span>}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {a.due_date ? (
                          <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {isOverdue ? '⚠ ' : ''}{new Date(a.due_date).toLocaleDateString('es-MX')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">Sin fecha</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/dashboard/flota/${(a.vehicles as unknown as { id?: string })?.id ?? ''}/mantenimiento`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-10 text-sm text-gray-400">
              <p>Sin alertas de mantenimiento abiertas.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
