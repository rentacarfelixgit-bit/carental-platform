// src/app/dashboard/contratos/page.tsx
// Contratos de mostrador (clientes sin reserva previa).
// Pestañas: Abiertos (por entregar / en uso) y Cerrados (cerrados / cancelados).
// Usan la misma tabla y el mismo flujo que las reservas; aquí solo se filtra origin = walk_in.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '../reservas/StatusBadge'
import {
  CONTRACT_STATUS, OPEN_CONTRACT_STATUSES, CLOSED_CONTRACT_STATUSES, rentalFolio,
} from '@/lib/rentalLabels'

const PAGE_SIZE = 20

type Tab = 'abiertos' | 'cerrados'

interface Props {
  searchParams: Promise<{ tab?: string; status?: string; page?: string }>
}

export default async function ContratosPage({ searchParams }: Props) {
  const sp = await searchParams
  const tab: Tab = sp.tab === 'cerrados' ? 'cerrados' : 'abiertos'
  const tabStatuses: readonly string[] = tab === 'abiertos' ? OPEN_CONTRACT_STATUSES : CLOSED_CONTRACT_STATUSES
  const status = sp.status && tabStatuses.includes(sp.status) ? sp.status : ''
  const page = Math.max(1, Number(sp.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) redirect('/login')

  const base = () => supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('origin', 'walk_in')

  const query = supabase
    .from('reservations')
    .select(`
      id, number, origin, start_date, end_date, status, created_at, total_amount,
      clients ( full_name, id_number ),
      vehicles ( plates, brand, model )
    `, { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .eq('origin', 'walk_in')
    .in('status', status ? [status] : [...tabStatuses])
    .order(tab === 'abiertos' ? 'start_date' : 'end_date', { ascending: tab === 'abiertos' })
    .range(from, to)

  const [{ data: contracts, count }, { count: openCount }, { count: closedCount }] = await Promise.all([
    query,
    base().in('status', [...OPEN_CONTRACT_STATUSES]),
    base().in('status', [...CLOSED_CONTRACT_STATUSES]),
  ])


  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function url(params: { tab?: Tab; status?: string; page?: number }) {
    const p = new URLSearchParams()
    const t = params.tab ?? tab
    if (t !== 'abiertos') p.set('tab', t)
    const s = params.status ?? ''
    if (s) p.set('status', s)
    if (params.page && params.page > 1) p.set('page', String(params.page))
    const str = p.toString()
    return `/dashboard/contratos${str ? `?${str}` : ''}`
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'abiertos', label: 'Abiertos', count: openCount ?? 0 },
    { id: 'cerrados', label: 'Cerrados', count: closedCount ?? 0 },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rentas de clientes que llegan a mostrador sin reserva</p>
        </div>
        <Link
          href="/dashboard/contratos/nuevo"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo contrato
        </Link>
      </div>

      {/* Pestañas */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1" aria-label="Estado del contrato">
          {tabs.map(t => {
            const selected = t.id === tab
            return (
              <Link
                key={t.id}
                href={url({ tab: t.id })}
                aria-current={selected ? 'page' : undefined}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  selected ? 'text-blue-700' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${selected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.count}
                </span>
                <span className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full ${selected ? 'bg-blue-600' : 'bg-transparent'}`} />
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Sub-filtro por estado dentro de la pestaña */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={url({})}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            !status ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todos
        </Link>
        {tabStatuses.map(s => (
          <Link
            key={s}
            href={url({ status: s })}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              status === s ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {CONTRACT_STATUS[s]?.label ?? s}
          </Link>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {contracts && contracts.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">No.</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Vehículo</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Fechas</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.map(c => {
                  const client  = c.clients  as unknown as { full_name: string; id_number: string } | null
                  const vehicle = c.vehicles as unknown as { plates: string; brand: string; model: string } | null
                  const days = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86_400_000)
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{rentalFolio(c.origin, c.number)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{client?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{client?.id_number}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-gray-700">{vehicle?.brand} {vehicle?.model}</p>
                        <p className="text-xs font-mono text-gray-400">{vehicle?.plates}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">
                        <p>{new Date(c.start_date).toLocaleDateString('es-MX')} →</p>
                        <p>{new Date(c.end_date).toLocaleDateString('es-MX')} <span className="text-gray-400">({days}d)</span></p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} origin={c.origin} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/reservas/${c.id}`}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">{from + 1}–{Math.min(to + 1, total)} de {total}</p>
                <div className="flex items-center gap-1">
                  {page > 1
                    ? <Link href={url({ status, page: page - 1 })} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">← Anterior</Link>
                    : <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">← Anterior</span>}
                  {page < totalPages
                    ? <Link href={url({ status, page: page + 1 })} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">Siguiente →</Link>
                    : <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">Siguiente →</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm">
              {tab === 'abiertos' ? 'No hay contratos abiertos.' : 'No hay contratos cerrados.'}
            </p>
            {tab === 'abiertos' && !status && (
              <Link href="/dashboard/contratos/nuevo" className="text-sm text-blue-600 hover:underline mt-1 inline-block">Abrir un contrato</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
