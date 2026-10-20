// src/app/dashboard/usuarios/page.tsx
// Usuarios del negocio: búsqueda, orden por columna y paginación (en el servidor).
// Los usuarios dados de baja (eliminados con historial) no aparecen.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsuariosTable from './UsuariosTable'
import { parseSort, sortOrders, applySortParams, type SortState } from '@/lib/tableSort'
import LinkPendingOverlay from '@/components/dashboard/LinkPendingOverlay'

const PAGE_SIZE = 20
const SORT_KEYS = ['usuario', 'rol', 'estado', 'alta'] as const
const SORT_COLUMNS: Record<typeof SORT_KEYS[number], readonly string[]> = {
  usuario: ['full_name'],
  rol:     ['role'],
  estado:  ['active'],
  alta:    ['created_at'],
}

interface Props {
  searchParams: Promise<{ q?: string; page?: string; orden?: string; dir?: string }>
}

export default async function UsuariosPage({ searchParams }: Props) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 100)
  const page = Math.max(1, Number(sp.page) || 1)
  const sort = parseSort(sp.orden, sp.dir, SORT_KEYS)
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    redirect('/dashboard')
  }

  const build = (withDeletedFilter: boolean) => {
    let query = supabase
      .from('users')
      .select('id, full_name, email, role, active, created_at', { count: 'exact' })
      .eq('tenant_id', profile.tenant_id)
      .range(from, to)
    if (withDeletedFilter) query = query.is('deleted_at', null)
    if (q) {
      // Quitar caracteres que rompen el filtro de PostgREST
      const term = q.replace(/[%,()*]/g, ' ').trim()
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    }
    for (const o of sortOrders(sort, SORT_COLUMNS, [['created_at', true]])) {
      query = query.order(o.column, { ascending: o.ascending, nullsFirst: false })
    }
    return query
  }

  let res = await build(true)
  // Si aún no se aplicó el script SQL (columna deleted_at), listar igual
  const missingDeletedAt = !!res.error && /deleted_at/.test(res.error.message)
  if (missingDeletedAt) res = await build(false)
  const usuarios = res.data ?? []
  const total = res.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function url(opts: { page?: number; sort?: SortState | null } = {}) {
    const params = applySortParams(new URLSearchParams(), opts.sort !== undefined ? opts.sort : sort)
    if (q) params.set('q', q)
    if (opts.page && opts.page > 1) params.set('page', String(opts.page))
    const s = params.toString()
    return `/dashboard/usuarios${s ? `?${s}` : ''}`
  }

  const clearHref = (() => {
    const s = applySortParams(new URLSearchParams(), sort).toString()
    return `/dashboard/usuarios${s ? `?${s}` : ''}`
  })()

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} usuario{total !== 1 ? 's' : ''}{q ? ' encontrados' : ' en tu organización'}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </p>
        </div>
        <Link
          href="/dashboard/usuarios/nuevo"
          className="inline-flex items-center justify-center gap-2 self-start sm:self-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo usuario
        </Link>
      </div>

      {missingDeletedAt && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Falta aplicar en Supabase el script <b>supabase_usuarios_oct2026.sql</b>: hasta entonces, eliminar usuarios con historial no estará disponible.
        </div>
      )}

      {/* Buscador (conserva el orden elegido) */}
      <form method="GET" className="flex gap-2 mb-4">
        {sort && <input type="hidden" name="orden" value={sort.key} />}
        {sort && <input type="hidden" name="dir" value={sort.dir} />}
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            name="q" defaultValue={q} maxLength={100} placeholder="Buscar por nombre o correo…"
            className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
          />
        </div>
        <button type="submit" className="px-4 py-2 text-[14px] text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Buscar
        </button>
        {q && (
          <Link href={clearHref}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 self-center">
            Limpiar
          </Link>
        )}
      </form>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {usuarios.length > 0 ? (
          <>
            <UsuariosTable
              usuarios={usuarios}
              currentUserId={user.id}
              sort={sort}
              sortBaseQuery={q ? `q=${encodeURIComponent(q)}` : ''}
              canDelete={!missingDeletedAt}
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">{from + 1}–{Math.min(to + 1, total)} de {total}</p>
                <div className="flex items-center gap-1">
                  {page > 1
                    ? <Link href={url({ page: page - 1 })} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">← Anterior<LinkPendingOverlay /></Link>
                    : <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">← Anterior</span>}
                  {page < totalPages
                    ? <Link href={url({ page: page + 1 })} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">Siguiente →<LinkPendingOverlay /></Link>
                    : <span className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-300 select-none">Siguiente →</span>}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-sm">{q ? `Ningún usuario coincide con "${q}".` : 'No hay usuarios todavía.'}</p>
            {!q && (
              <Link href="/dashboard/usuarios/nuevo" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                Crear el primero
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
