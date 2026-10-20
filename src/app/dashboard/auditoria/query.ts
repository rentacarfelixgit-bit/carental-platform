// src/app/dashboard/auditoria/query.ts
// Filtros de la Auditoría compartidos por la pantalla y la exportación a CSV.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSort, sortOrders, type SortState } from '@/lib/tableSort'
import { AUDIT_TABLES, type AuditAction } from '@/lib/audit'

export const AUDIT_SORT_KEYS = ['fecha', 'usuario', 'accion', 'modulo', 'registro'] as const
const SORT_COLUMNS: Record<typeof AUDIT_SORT_KEYS[number], readonly string[]> = {
  fecha:    ['occurred_at'],
  usuario:  ['actor_name'],
  accion:   ['action'],
  modulo:   ['table_name'],
  registro: ['record_label'],
}

export interface AuditFilters {
  desde: string        // YYYY-MM-DD (zona del negocio)
  hasta: string
  usuario: string      // uuid | 'sistema' | ''
  modulo: string       // nombre de tabla | ''
  accion: AuditAction | ''
  q: string            // texto en la etiqueta del registro (R-0012, placas, nombre…)
  registro: string     // id de un registro: su historial completo (incluye inspecciones, cargos…)
  sort: SortState<typeof AUDIT_SORT_KEYS[number]> | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f-]{36}$/i

/** Fecha de hoy (YYYY-MM-DD) en la zona del negocio */
export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Desfase de la zona horaria en una fecha, p. ej. "-04:00" */
function tzOffset(tz: string, date: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${date}T12:00:00Z`))
    const name = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT'
    const m = name.match(/GMT([+-]\d{2}):?(\d{2})?/)
    return m ? `${m[1]}:${m[2] ?? '00'}` : '+00:00'
  } catch {
    return '+00:00'
  }
}

export function parseAuditFilters(sp: Record<string, string | undefined>, tz: string): AuditFilters {
  const today = todayIn(tz)
  const weekAgo = new Date(`${today}T12:00:00Z`); weekAgo.setUTCDate(weekAgo.getUTCDate() - 6)
  const registro = sp.registro && UUID_RE.test(sp.registro) ? sp.registro : ''
  // Al ver el historial de un registro se muestra todo, sin límite de fechas
  const desde = sp.desde && DATE_RE.test(sp.desde) ? sp.desde : registro ? '' : weekAgo.toISOString().slice(0, 10)
  const hasta = sp.hasta && DATE_RE.test(sp.hasta) ? sp.hasta : registro ? '' : today
  const accion = (['create', 'update', 'delete', 'status'] as const).find(a => a === sp.accion) ?? ''
  return {
    desde, hasta, accion, registro,
    usuario: sp.usuario === 'sistema' || (sp.usuario && UUID_RE.test(sp.usuario)) ? sp.usuario : '',
    modulo: sp.modulo && (sp.modulo in AUDIT_TABLES || /^[a-z_]{1,63}$/.test(sp.modulo)) ? sp.modulo : '',
    q: (sp.q ?? '').trim().slice(0, 60),
    sort: parseSort(sp.orden, sp.dir, AUDIT_SORT_KEYS),
  }
}

/** Parámetros de URL de los filtros (sin página ni orden) */
export function filtersToParams(f: AuditFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  if (f.usuario) p.set('usuario', f.usuario)
  if (f.modulo) p.set('modulo', f.modulo)
  if (f.accion) p.set('accion', f.accion)
  if (f.q) p.set('q', f.q)
  if (f.registro) p.set('registro', f.registro)
  return p
}

export const AUDIT_SELECT =
  'id, occurred_at, actor_id, actor_name, actor_role, action, table_name, record_id, record_label, parent_table, parent_id, changes, source, ip, user_agent'

/** Consulta con filtros y orden (la seguridad la pone RLS: solo admins del negocio) */
export function auditQuery(supabase: SupabaseClient, tenantId: string, f: AuditFilters, tz: string, opts: { count?: boolean } = {}) {
  let q = supabase.from('audit_events')
    .select(AUDIT_SELECT, opts.count ? { count: 'exact' } : undefined)
    .eq('tenant_id', tenantId)
  if (f.desde) q = q.gte('occurred_at', `${f.desde}T00:00:00${tzOffset(tz, f.desde)}`)
  if (f.hasta) q = q.lte('occurred_at', `${f.hasta}T23:59:59.999${tzOffset(tz, f.hasta)}`)
  if (f.usuario === 'sistema') q = q.is('actor_id', null)
  else if (f.usuario) q = q.eq('actor_id', f.usuario)
  if (f.modulo) q = q.eq('table_name', f.modulo)
  if (f.accion) q = q.eq('action', f.accion)
  if (f.registro) q = q.or(`record_id.eq.${f.registro},parent_id.eq.${f.registro}`)
  if (f.q) {
    const term = f.q.replace(/[%,()*]/g, ' ').trim()
    if (term) q = q.ilike('record_label', `%${term}%`)
  }
  for (const o of sortOrders(f.sort, SORT_COLUMNS, [['occurred_at', false], ['id', false]])) {
    q = q.order(o.column, { ascending: o.ascending, nullsFirst: false })
  }
  return q
}
