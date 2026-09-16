// src/app/dashboard/clientes/page.tsx
// Lista de clientes con búsqueda y badge de lista negra — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ID_TYPE_LABELS: Record<string, string> = {
  license:  'Licencia',
  passport: 'Pasaporte',
}

const PAGE_SIZE = 20

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function ClientesPage({ searchParams }: Props) {
  const { q = '', page: pageParam = '1' } = await searchParams
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
    .from('clients')
    .select('id, full_name, id_type, id_number, phone, email, license_expiry, created_at', { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) query = query.or(`full_name.ilike.%${q}%,id_number.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)

  const [{ data: clients, count }, { data: blacklistEntries }] = await Promise.all([
    query,
    // IDs de clientes en lista negra activa
    supabase
      .from('client_blacklist')
      .select('client_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true),
  ])

  const blacklistedIds = new Set((blacklistEntries ?? []).map(b => b.client_id))
  const today = new Date(); today.setHours(0,0,0,0)
  const in30  = new Date(today); in30.setDate(today.getDate() + 30)

  function licenseStatus(expiry: string | null): 'expired' | 'soon' | 'ok' | 'none' {
    if (!expiry) return 'none'
    const d = new Date(expiry); d.setHours(0,0,0,0)
    if (d < today) return 'expired'
    if (d <= in30)  return 'soon'
    return 'ok'
  }
  const total      = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filterParams = new URLSearchParams()
  if (q) filterParams.set('q', q)

  function pageUrl(p: number) {
    const params = new URLSearchParams(filterParams)
    if (p > 1) params.set('page', String(p))
    const str = params.toString()
    return `/dashboard/clientes${str ? `?${str}` : ''}`
  }

  function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (current > 3) pages.push('...')
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
    if (current < total - 2) pages.push('...')
    if (total > 1) pages.push(total)
    return pages
  }

  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} cliente{total !== 1 ? 's' : ''}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </p>
        </div>
        <Link
          href="/dashboard/clientes/nuevo"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar cliente
        </Link>
      </div>

      {/* Búsqueda */}
      <form method="GET" className="flex gap-3 mb-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, ID, teléfono o email..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Buscar
        </button>
        {q && (
          <Link href="/dashboard/clientes" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {clients && clients.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Identificación</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Contacto</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => {
                  const isBlacklisted = blacklistedIds.has(c.id)
                  const lic = licenseStatus((c as { license_expiry?: string | null }).license_expiry ?? null)
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-medium text-gray-900">{c.full_name}</p>
                          {isBlacklisted && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                              Lista negra
                            </span>
                          )}
                          {lic === 'expired' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                              Licencia vencida
                            </span>
                          )}
                          {lic === 'soon' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                              Licencia por vencer
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Registrado {new Date(c.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-gray-500">{ID_TYPE_LABELS[c.id_type] ?? c.id_type}</p>
                        <p className="font-mono text-sm text-gray-700">{c.id_number}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600">
                        <p>{c.phone ?? <span className="text-gray-300">—</span>}</p>
                        <p className="text-xs text-gray-400">{c.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/clientes/${c.id}/editar`}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            isBlacklisted
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Editar
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
                <p className="text-xs text-gray-500">
                  {from + 1}–{Math.min(to + 1, total)} de {total} clientes
                </p>
                <div className="flex items-center gap-1">
                  {page > 1 ? (
                    <Link href={pageUrl(page - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">← Anterior</Link>
                  ) : (
                    <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">← Anterior</span>
                  )}
                  {pageNumbers.map((p, i) =>
                    p === '...' ? (
                      <span key={`e-${i}`} className="px-2 text-xs text-gray-400">…</span>
                    ) : (
                      <Link key={p} href={pageUrl(p)} className={`w-8 h-8 flex items-center justify-center text-xs rounded-lg border transition-colors ${p === page ? 'bg-blue-600 border-blue-600 text-white font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>{p}</Link>
                    )
                  )}
                  {page < totalPages ? (
                    <Link href={pageUrl(page + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Siguiente →</Link>
                  ) : (
                    <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">Siguiente →</span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm">{q ? 'Sin resultados para esa búsqueda.' : 'No hay clientes registrados aún.'}</p>
            {!q && (
              <Link href="/dashboard/clientes/nuevo" className="text-sm text-blue-600 hover:underline mt-1 inline-block">Agregar el primero</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
