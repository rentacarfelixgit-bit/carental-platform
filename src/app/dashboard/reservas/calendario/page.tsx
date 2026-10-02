// src/app/dashboard/reservas/calendario/page.tsx
// Calendario mensual — grid 7 columnas Dom→Sáb

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pending:   { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400' },
  confirmed: { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  active:    { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  completed: { bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
  cancelled: { bg: 'bg-red-50',     text: 'text-red-400',    dot: 'bg-red-300'    },
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmada',
  active:    'En curso',
}

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface Reservation {
  id: string
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
  status: string
  clients:  { full_name: string } | { full_name: string }[] | null
  vehicles: { brand: string; model: string; plates: string } | { brand: string; model: string; plates: string }[] | null
}

function clientName(r: Reservation): string {
  if (!r.clients) return '—'
  const c = Array.isArray(r.clients) ? r.clients[0] : r.clients
  return c?.full_name ?? '—'
}

function vehicleLabel(r: Reservation): string {
  if (!r.vehicles) return ''
  const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles
  return v ? `${v.brand} ${v.model} · ${v.plates}` : ''
}

function parseMonth(mes?: string) {
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number)
    return { year: y, month: m }
  }
  const n = new Date()
  return { year: n.getFullYear(), month: n.getMonth() + 1 }
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function dayStr(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

// Day of week (0=Sun) for the 1st of month
function firstDowOfMonth(year: number, month: number) {
  return new Date(`${year}-${pad2(month)}-01T12:00:00Z`).getUTCDay()
}

interface Props {
  searchParams: Promise<{ mes?: string }>
}

export default async function CalendarioReservasPage({ searchParams }: Props) {
  const { mes } = await searchParams
  const { year, month } = parseMonth(mes)

  const totalDays = daysInMonth(year, month)
  const firstDow  = firstDowOfMonth(year, month)   // 0–6, how many blank cells at start

  const firstDate = dayStr(year, month, 1)
  const lastDate  = dayStr(year, month, totalDays)

  // Month navigation
  const prevMonth = month === 1
    ? `${year - 1}-12`
    : `${year}-${pad2(month - 1)}`
  const nextMonth = month === 12
    ? `${year + 1}-01`
    : `${year}-${pad2(month + 1)}`

  const now     = new Date()
  const thisMes = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const today   = now.toISOString().slice(0, 10)

  const monthName = new Date(`${year}-${pad2(month)}-15`)
    .toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, start_date, end_date, status, clients(full_name), vehicles(brand, model, plates)')
    .eq('tenant_id', profile.tenant_id)
    .not('status', 'in', '("cancelled","completed")')
    .lte('start_date', lastDate)
    .gte('end_date',   firstDate)
    .order('start_date') as { data: Reservation[] | null }

  // Map: day (1..31) → reservations active that day
  const byDay: Record<number, Reservation[]> = {}
  for (let d = 1; d <= totalDays; d++) byDay[d] = []

  for (const r of reservations ?? []) {
    for (let d = 1; d <= totalDays; d++) {
      const ds = dayStr(year, month, d)
      if (r.start_date <= ds && r.end_date >= ds) byDay[d].push(r)
    }
  }

  // Build calendar grid cells: leading blanks + days
  const cells: Array<{ day: number } | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => ({ day: i + 1 })),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  // Days with content for mobile list view (skip empty days)
  const activeDays = Array.from({ length: totalDays }, (_, i) => i + 1)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <Link href="/dashboard/reservas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Reservas
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 capitalize">{monthName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{reservations?.length ?? 0} reservas activas</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`?mes=${prevMonth}`} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">←</Link>
          <Link href={`?mes=${thisMes}`}   className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">Hoy</Link>
          <Link href={`?mes=${nextMonth}`} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">→</Link>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[k].dot}`} />
            {label}
          </span>
        ))}
      </div>

      {/* ── DESKTOP: Grid 7 columnas ────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header días de semana */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DOW_LABELS.map((d) => (
            <div key={d} className={`py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${d === 'Dom' || d === 'Sáb' ? 'text-gray-400' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Semanas */}
        <div className="grid grid-cols-7 divide-x divide-gray-100">
          {cells.map((cell, i) => {
            const isLastRow = i >= cells.length - 7
            const colIndex  = i % 7
            const isWeekend = colIndex === 0 || colIndex === 6

            if (!cell) {
              return (
                <div key={`blank-${i}`} className={`min-h-[130px] ${isLastRow ? '' : 'border-b border-gray-100'} ${isWeekend ? 'bg-gray-50/80' : 'bg-gray-50/30'}`} />
              )
            }

            const { day } = cell
            const ds      = dayStr(year, month, day)
            const isToday = ds === today
            const rsvs    = byDay[day] ?? []
            const MAX     = 3
            const extra   = rsvs.length - MAX

            return (
              <div key={`day-${day}`} className={`min-h-[130px] p-2 group relative ${isLastRow ? '' : 'border-b border-gray-100'} ${isToday ? 'bg-blue-50/50' : isWeekend ? 'bg-gray-50/50' : 'bg-white'} hover:bg-gray-50/80 transition-colors`}>
                <div className="flex items-center justify-between mb-1.5">
                  <Link
                    href={`/dashboard/reservas/nueva?start=${ds}`}
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-100 hover:text-blue-700'}`}
                  >
                    {day}
                  </Link>
                  <Link
                    href={`/dashboard/reservas/nueva?start=${ds}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </Link>
                </div>
                <div className="space-y-0.5">
                  {rsvs.slice(0, MAX).map((r) => {
                    const col = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending
                    return (
                      <Link key={r.id} href={`/dashboard/reservas/${r.id}`}
                        className={`flex items-center gap-1 w-full px-1.5 py-0.5 rounded text-xs truncate ${col.bg} ${col.text} hover:brightness-95`}
                        title={`${clientName(r)} · ${vehicleLabel(r)}`}
                      >
                        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${col.dot}`} />
                        <span className="truncate">{clientName(r)}</span>
                      </Link>
                    )
                  })}
                  {extra > 0 && <p className="text-xs text-gray-400 pl-1">+{extra} más</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── MÓVIL: Lista vertical de días ───────────────────────────── */}
      <div className="md:hidden space-y-1">
        {activeDays.map((day) => {
          const ds      = dayStr(year, month, day)
          const isToday = ds === today
          const dow     = new Date(`${ds}T12:00:00Z`).getUTCDay()
          const dowLabel = DOW_LABELS[dow]
          const rsvs    = byDay[day] ?? []
          const hasRsvs = rsvs.length > 0

          return (
            <div key={day} className={`rounded-xl border ${isToday ? 'border-blue-200 bg-blue-50/40' : hasRsvs ? 'border-gray-200 bg-white' : 'border-transparent bg-transparent'}`}>
              <div className={`flex items-center gap-3 px-3 py-2 ${!hasRsvs ? 'opacity-50' : ''}`}>
                {/* Número + día */}
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-xs text-gray-400 uppercase">{dowLabel}</p>
                  <div className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-blue-600 text-white' : 'text-gray-800'}`}>
                    {day}
                  </div>
                </div>

                {/* Reservas o placeholder */}
                <div className="flex-1 min-w-0">
                  {hasRsvs ? (
                    <div className="space-y-1">
                      {rsvs.map((r) => {
                        const col = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending
                        return (
                          <Link key={r.id} href={`/dashboard/reservas/${r.id}`}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${col.bg} ${col.text}`}
                          >
                            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${col.dot}`} />
                            <span className="font-medium truncate">{clientName(r)}</span>
                            <span className="text-xs opacity-60 truncate hidden sm:block">{vehicleLabel(r)}</span>
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    <Link href={`/dashboard/reservas/nueva?start=${ds}`} className="text-xs text-gray-300 hover:text-blue-500 transition-colors">
                      Sin reservas · + agregar
                    </Link>
                  )}
                </div>

                {/* Botón + en días con reservas */}
                {hasRsvs && (
                  <Link href={`/dashboard/reservas/nueva?start=${ds}`} className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center hidden md:block">
        Clic en el número del día para crear una reserva · Clic en una reserva para verla
      </p>
    </div>
  )
}
