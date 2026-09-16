// src/app/dashboard/reservas/page.tsx
// Lista de reservas con filtro por estado y paginación — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge, { STATUS_CONFIG } from './StatusBadge'

const PAGE_SIZE = 20
const ALL_STATUSES = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }))

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function ReservasPage({ searchParams }: Props) {
  const { status = '', page: pageParam = '1' } = await searchParams
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

  let query = supabase
    .from('reservations')
    .select(`
      id, start_date, end_date, status, created_at,
      clients ( full_name, id_number ),
      vehicles ( plates, brand, model )
    `, { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data: reservations, count } = await query

  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageUrl(p: number, s = status) {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    if (p > 1) params.set('page', String(p))
    const str = params.toString()
    return `/dashboard/reservas${str ? `?${str}` : ''}`
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} reserva{total !== 1 ? 's' : ''}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </p>
        </div>
        <Link
          href="/dashboard/reservas/nueva"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva reserva
        </Link>
      </div>

      {/* Filtro por estado */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href={pageUrl(1, '')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            !status ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todas
        </Link>
        {ALL_STATUSES.map(s => (
          <Link
            key={s.value}
            href={pageUrl(1, s.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              status === s.value
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {reservations && reservations.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Vehículo</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Fechas</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservations.map((r) => {
                  const client  = r.clients  as { full_name: string; id_number: string } | null
                  const vehicle = r.vehicles as { plates: string; brand: string; model: string } | null
                  const nights  = Math.ceil(
                    (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{client?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{client?.id_number}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-gray-700">{vehicle?.brand} {vehicle?.model}</p>
                        <p className="text-xs font-mono text-gray-400">{vehicle?.plates}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">
                        <p>{new Date(r.start_date).toLocaleDateString('es-MX')} →</p>
                        <p>{new Date(r.end_date).toLocaleDateString('es-MX')} <span className="text-gray-400">({nights}d)</span></p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/reservas/${r.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">{from + 1}–{Math.min(to + 1, total)} de {total}</p>
                <div className="flex items-center gap-1">
                  {page > 1
                    ? <Link href={pageUrl(page - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">← Anterior</Link>
                    : <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">← Anterior</span>}
                  {page < totalPages
                    ? <Link href={pageUrl(page + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">Siguiente →</Link>
                    : <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">Siguiente →</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
            <p className="text-sm">{status ? 'Sin reservas con ese estado.' : 'No hay reservas aún.'}</p>
            {!status && (
              <Link href="/dashboard/reservas/nueva" className="text-sm text-blue-600 hover:underline mt-1 inline-block">Crear la primera</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
