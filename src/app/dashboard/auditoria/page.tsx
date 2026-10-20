// src/app/dashboard/auditoria/page.tsx
// Auditoría: todos los movimientos de los usuarios (solo administradores).
// Los registra la base de datos con triggers (supabase_auditoria_oct2026.sql), así que no se
// pueden saltar ni editar. Filtros por fecha, usuario, módulo, acción y registro; orden; paginación; CSV.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { applySortParams, type SortState } from '@/lib/tableSort'
import { SortLinkTh } from '@/components/dashboard/SortableTh'
import LinkPendingOverlay from '@/components/dashboard/LinkPendingOverlay'
import {
  AUDIT_ACTIONS, AUDIT_TABLES, tableLabel, recordHref, fieldLabel, formatValue,
  HIDDEN_FIELDS, SENSITIVE_FIELDS, type AuditEvent,
} from '@/lib/audit'
import { parseAuditFilters, filtersToParams, auditQuery } from './query'

const PAGE_SIZE = 50
const MAX_INLINE = 4
const ROLE_LABELS: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', operator: 'Operador' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AuditoriaPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) redirect('/dashboard')

  const { data: tenant } = await supabase.from('tenants').select('timezone').eq('id', profile.tenant_id).single()
  const tz = (tenant?.timezone as string | undefined) || 'America/Santo_Domingo'
  const f = parseAuditFilters(sp, tz)
  const page = Math.max(1, Number(sp.page) || 1)
  const from = (page - 1) * PAGE_SIZE

  const [{ data, count, error }, { data: people }] = await Promise.all([
    auditQuery(supabase, profile.tenant_id, f, tz, { count: true }).range(from, from + PAGE_SIZE - 1),
    supabase.from('users').select('id, full_name').eq('tenant_id', profile.tenant_id).order('full_name'),
  ])
  const missingTable = !!error && /audit_events/.test(error.message)
  const events = (data ?? []) as unknown as AuditEvent[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Registro cuyo historial se está viendo
  const focus = f.registro ? events.find(e => e.record_id === f.registro) ?? null : null

  function url(opts: { page?: number; sort?: SortState | null } = {}) {
    const p = applySortParams(filtersToParams(f), opts.sort !== undefined ? opts.sort : f.sort)
    if (opts.page && opts.page > 1) p.set('page', String(opts.page))
    const s = p.toString()
    return `/dashboard/auditoria${s ? `?${s}` : ''}`
  }
  const sortHref = (next: SortState | null) => url({ sort: next })
  const exportHref = (() => {
    const p = applySortParams(filtersToParams(f), f.sort)
    return `/dashboard/auditoria/exportar?${p.toString()}`
  })()

  const fmtWhen = (d: string) => new Date(d).toLocaleString('es-MX', {
    timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const inputCls = 'w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Auditoría</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Todos los movimientos de los usuarios. Se registran automáticamente y no se pueden modificar ni borrar.
          </p>
        </div>
        {!missingTable && total > 0 && (
          <a href={exportHref}
            className="inline-flex items-center justify-center gap-2 self-start sm:self-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar CSV
          </a>
        )}
      </div>

      {missingTable && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          La auditoría aún no está activa. Corre en Supabase (SQL Editor) el script <b>supabase_auditoria_oct2026.sql</b> de la raíz del proyecto.
        </div>
      )}

      {/* Historial de un registro */}
      {f.registro && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            Historial de <b>{focus?.record_label ?? 'este registro'}</b>
            {focus && <> · {tableLabel(focus.table_name)}</>} — incluye sus inspecciones, cargos, cambios y demás movimientos relacionados.
          </span>
          <Link href="/dashboard/auditoria" className="text-blue-700 font-medium hover:underline">Ver toda la auditoría</Link>
        </div>
      )}

      {/* Filtros */}
      <form method="GET" className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        {f.registro && <input type="hidden" name="registro" value={f.registro} />}
        {f.sort && <input type="hidden" name="orden" value={f.sort.key} />}
        {f.sort && <input type="hidden" name="dir" value={f.sort.dir} />}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" name="desde" defaultValue={f.desde} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" name="hasta" defaultValue={f.hasta} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Usuario</label>
          <select name="usuario" defaultValue={f.usuario} className={inputCls}>
            <option value="">Todos</option>
            {(people ?? []).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            <option value="sistema">Sistema / SQL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Módulo</label>
          <select name="modulo" defaultValue={f.modulo} className={inputCls}>
            <option value="">Todos</option>
            {Object.entries(AUDIT_TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Acción</label>
          <select name="accion" defaultValue={f.accion} className={inputCls}>
            <option value="">Todas</option>
            {Object.entries(AUDIT_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Registro</label>
          <input name="q" defaultValue={f.q} placeholder="R-0012, placas, nombre…" maxLength={60} className={inputCls} />
        </div>
        <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center gap-2">
          <button type="submit" className="px-4 py-2 text-[14px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Filtrar
          </button>
          <Link href="/dashboard/auditoria" className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Limpiar filtros</Link>
          <span className="ml-auto text-xs text-gray-500">
            {total.toLocaleString('es-MX')} movimiento{total !== 1 ? 's' : ''}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </span>
        </div>
      </form>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {events.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <SortLinkTh label="Fecha"    sortKey="fecha"    sort={f.sort} href={sortHref} className="w-40" />
                    <SortLinkTh label="Usuario"  sortKey="usuario"  sort={f.sort} href={sortHref} className="w-44" />
                    <SortLinkTh label="Acción"   sortKey="accion"   sort={f.sort} href={sortHref} className="w-32" />
                    <SortLinkTh label="Registro" sortKey="registro" sort={f.sort} href={sortHref} className="w-56" />
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map(e => {
                    const act = AUDIT_ACTIONS[e.action] ?? AUDIT_ACTIONS.update
                    const href = recordHref(e.table_name, e.record_id) ?? recordHref(e.parent_table ?? '', e.parent_id)
                    const entries = Object.entries(e.changes ?? {})
                      .filter(([k, v]) => !HIDDEN_FIELDS.has(k)
                        // En altas y bajas, los ids técnicos no aportan
                        && !(e.action !== 'update' && e.action !== 'status' && typeof (v.new ?? v.old) === 'string' && UUID_RE.test(String(v.new ?? v.old))))
                      .sort(([a], [b]) => Number(SENSITIVE_FIELDS.has(b)) - Number(SENSITIVE_FIELDS.has(a)))
                    const renderEntry = ([k, v]: [string, { old?: unknown; new?: unknown }]) => {
                      const sensitive = SENSITIVE_FIELDS.has(k) && (e.action === 'update' || e.action === 'status' || e.action === 'delete')
                      return (
                        <li key={k} className={sensitive ? 'text-amber-800' : 'text-gray-700'}>
                          <span className="text-gray-500">{fieldLabel(k)}:</span>{' '}
                          {e.action === 'update' || e.action === 'status' ? (
                            <>
                              <span className="line-through decoration-gray-300 text-gray-500">{formatValue(e.table_name, k, v.old, e)}</span>
                              {' → '}
                              <span className="font-medium">{formatValue(e.table_name, k, v.new, e)}</span>
                            </>
                          ) : (
                            <span>{formatValue(e.table_name, k, e.action === 'delete' ? v.old : v.new, e)}</span>
                          )}
                        </li>
                      )
                    }
                    return (
                      <tr key={e.id} className={`align-top hover:bg-gray-50 ${e.action === 'delete' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtWhen(e.occurred_at)}</td>
                        <td className="px-4 py-3">
                          {e.actor_id ? (
                            <>
                              <p className="font-medium text-gray-900">{e.actor_name ?? 'Usuario eliminado'}</p>
                              <p className="text-xs text-gray-400">{ROLE_LABELS[e.actor_role ?? ''] ?? e.actor_role ?? ''}</p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-500 italic">Sistema / SQL</p>
                          )}
                          {e.ip && <p className="text-[11px] text-gray-400 font-mono" title={e.user_agent ?? ''}>{e.ip}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${act.className}`}>{act.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-500">{tableLabel(e.table_name)}</p>
                          {href ? (
                            <Link href={href} className="font-medium text-blue-700 hover:underline">{e.record_label || 'Ver registro'}</Link>
                          ) : (
                            <p className="font-medium text-gray-900">{e.record_label || '—'}</p>
                          )}
                          {(e.record_id || e.parent_id) && !f.registro && (
                            <Link href={`/dashboard/auditoria?registro=${e.parent_table === 'reservations' || e.parent_table === 'vehicles' || e.parent_table === 'clients' ? e.parent_id : e.record_id}`}
                              className="block text-[11px] text-gray-400 hover:text-blue-600">
                              Ver historial
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {entries.length === 0 ? <span className="text-gray-400">—</span> : (
                            <>
                              <ul className="space-y-0.5">{entries.slice(0, MAX_INLINE).map(renderEntry)}</ul>
                              {entries.length > MAX_INLINE && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-blue-600 hover:underline select-none">
                                    Ver {entries.length - MAX_INLINE} campo{entries.length - MAX_INLINE !== 1 ? 's' : ''} más
                                  </summary>
                                  <ul className="space-y-0.5 mt-1">{entries.slice(MAX_INLINE).map(renderEntry)}</ul>
                                </details>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">{(from + 1).toLocaleString('es-MX')}–{Math.min(from + PAGE_SIZE, total).toLocaleString('es-MX')} de {total.toLocaleString('es-MX')}</p>
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
        ) : !missingTable && (
          <div className="text-center py-14 text-gray-400">
            <p className="text-sm">No hay movimientos con estos filtros.</p>
            {(f.desde || f.hasta) && <p className="text-xs mt-1">Prueba ampliando el rango de fechas.</p>}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Los movimientos se conservan 2 años. Los cambios de precios, totales, abonos, tasa y estados se resaltan en ámbar.
      </p>
    </div>
  )
}
