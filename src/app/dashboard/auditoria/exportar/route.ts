// src/app/dashboard/auditoria/exportar/route.ts
// Exporta la Auditoría (con los mismos filtros de la pantalla) a CSV para Excel.
// Una fila por campo modificado, para poder filtrar y analizar fácilmente.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUDIT_ACTIONS, tableLabel, fieldLabel, formatValue, type AuditEvent } from '@/lib/audit'
import { parseAuditFilters, auditQuery } from '../query'

const BATCH = 1000
const MAX_ROWS = 20000

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return new NextResponse('No autorizado', { status: 403 })
  }
  const { data: tenant } = await supabase.from('tenants').select('timezone').eq('id', profile.tenant_id).single()
  const tz = (tenant?.timezone as string | undefined) || 'America/Santo_Domingo'
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries())
  const f = parseAuditFilters(sp, tz)

  const events: AuditEvent[] = []
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { data, error } = await auditQuery(supabase, profile.tenant_id, f, tz).range(from, from + BATCH - 1)
    if (error) return new NextResponse(`Error: ${error.message}`, { status: 500 })
    events.push(...((data ?? []) as unknown as AuditEvent[]))
    if (!data || data.length < BATCH) break
  }

  const fmtWhen = (d: string) => new Date(d).toLocaleString('es-MX', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const header = ['Fecha', 'Usuario', 'Rol', 'Origen', 'Acción', 'Módulo', 'Registro', 'Campo', 'Antes', 'Después', 'IP', 'Navegador', 'ID registro', 'ID evento']
  const lines = [header.map(csvCell).join(',')]
  for (const e of events) {
    const base = [
      fmtWhen(e.occurred_at), e.actor_name ?? (e.actor_id ? 'Usuario eliminado' : 'Sistema / SQL'), e.actor_role ?? '',
      e.source ?? '', AUDIT_ACTIONS[e.action]?.label ?? e.action, tableLabel(e.table_name), e.record_label ?? '',
    ]
    const tail = [e.ip ?? '', e.user_agent ?? '', e.record_id ?? '', e.id]
    const entries = Object.entries(e.changes ?? {})
    if (entries.length === 0) {
      lines.push([...base, '', '', '', ...tail].map(csvCell).join(','))
      continue
    }
    for (const [k, v] of entries) {
      lines.push([
        ...base, fieldLabel(k),
        'old' in v ? formatValue(e.table_name, k, v.old, e) : '',
        'new' in v ? formatValue(e.table_name, k, v.new, e) : '',
        ...tail,
      ].map(csvCell).join(','))
    }
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
