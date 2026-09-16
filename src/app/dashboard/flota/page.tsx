import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClearFiltersLink from './ClearFiltersLink'
import EditVehicleLink from './EditVehicleLink'
import MaintenanceLink from './MaintenanceLink'
import VehicleStatusSelect from './VehicleStatusSelect'

const PAGE_SIZE = 20

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available:   { label: 'Disponible',    className: 'bg-green-100 text-green-700' },
  reserved:    { label: 'Reservado',     className: 'bg-blue-100 text-blue-700' },
  in_use:      { label: 'En uso',        className: 'bg-yellow-100 text-yellow-700' },
  maintenance: { label: 'Mantenimiento', className: 'bg-orange-100 text-orange-700' },
  retained:    { label: 'Retenido',      className: 'bg-red-100 text-red-700' },
}

const ALL_STATUSES = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }))

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  if (total > 1) pages.push(total)
  return pages
}

interface Props {
  searchParams: Promise<{ q?: string; status?: string; inactivos?: string; page?: string }>
}

export default async function FlotaPage({ searchParams }: Props) {
  const { q = '', status = '', inactivos = '', page: pageParam = '1' } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  // Construir query con filtros + paginación
  let query = supabase
    .from('vehicles')
    .select('id, plates, brand, model, year, color, status, active, insurance_expiry, permit_expiry', { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (!inactivos) query = query.eq('active', true)
  if (status)     query = query.eq('status', status)
  if (q)          query = query.or(`plates.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`)

  const [{ data: vehicles, count }, { data: openAlerts }] = await Promise.all([
    query,
    // IDs de vehículos con alertas abiertas en este tenant
    supabase
      .from('vehicle_maintenance_alerts')
      .select('vehicle_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('resolved', false),
  ])

  const alertVehicleIds = new Set((openAlerts ?? []).map(a => a.vehicle_id))

  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Helpers para construir URLs de paginación preservando filtros
  const filterParams = new URLSearchParams()
  if (q)         filterParams.set('q', q)
  if (status)    filterParams.set('status', status)
  if (inactivos) filterParams.set('inactivos', inactivos)

  function pageUrl(p: number) {
    const params = new URLSearchParams(filterParams)
    if (p > 1) params.set('page', String(p))
    const str = params.toString()
    return `/dashboard/flota${str ? `?${str}` : ''}`
  }

  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Flota</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} vehículo{total !== 1 ? 's' : ''}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </p>
        </div>
        <Link
          href="/dashboard/flota/nuevo"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar vehículo
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 mb-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por placas, marca o modelo..."
          className="flex-1 min-w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={!!inactivos} className="rounded" />
          Ver inactivos
        </label>
        <button
          type="submit"
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Filtrar
        </button>
        {(q || status || inactivos) && (
          <ClearFiltersLink />
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {vehicles && vehicles.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vehículo</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Placas</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Estado</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Seguro</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.map((v) => {
                  const insuranceExpired = v.insurance_expiry && new Date(v.insurance_expiry) < new Date()
                  const hasOpenAlerts = alertVehicleIds.has(v.id)

                  return (
                    <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${!v.active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{v.brand} {v.model}</p>
                            <p className="text-xs text-gray-500">{v.year} · {v.color}</p>
                          </div>
                          {hasOpenAlerts && (
                            <span title="Tiene alertas de mantenimiento abiertas" className="text-orange-500">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-700">{v.plates}</td>
                      <td className="px-4 py-3">
                        <VehicleStatusSelect
                          vehicleId={v.id}
                          currentStatus={v.status}
                          statuses={ALL_STATUSES}
                          statusConfig={STATUS_CONFIG}
                        />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {v.insurance_expiry ? (
                          <span className={`text-xs ${insuranceExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {insuranceExpired ? '⚠ ' : ''}{new Date(v.insurance_expiry).toLocaleDateString('es-MX')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <MaintenanceLink vehicleId={v.id} hasOpenAlerts={hasOpenAlerts} />
                          <EditVehicleLink vehicleId={v.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  {from + 1}–{Math.min(to + 1, total)} de {total} vehículos
                </p>

                <div className="flex items-center gap-1">
                  {/* Anterior */}
                  {page > 1 ? (
                    <Link
                      href={pageUrl(page - 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      ← Anterior
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">
                      ← Anterior
                    </span>
                  )}

                  {/* Números de página */}
                  {pageNumbers.map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400 select-none">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={pageUrl(p)}
                        className={`w-8 h-8 flex items-center justify-center text-xs rounded-lg border transition-colors ${
                          p === page
                            ? 'bg-blue-600 border-blue-600 text-white font-medium'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </Link>
                    )
                  )}

                  {/* Siguiente */}
                  {page < totalPages ? (
                    <Link
                      href={pageUrl(page + 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Siguiente →
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">
                      Siguiente →
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <p className="text-sm">
              {q || status ? 'Sin resultados para esa búsqueda.' : 'No hay vehículos registrados aún.'}
            </p>
            {!q && !status && (
              <Link href="/dashboard/flota/nuevo" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                Agregar el primero
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
