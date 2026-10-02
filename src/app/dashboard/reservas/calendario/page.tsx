// src/app/dashboard/reservas/calendario/page.tsx
// Calendario mensual de reservas — vista por quincena

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
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface Reservation {
  id: string
  start_date: string
  end_date: string
  status: string
  clients: { full_name: string } | { full_name: string }[] | null
  vehicles: { brand: string; model: string; plates: string } | { brand: string; model: string; plates: string }[] | null
}

function getClient(r: Reservation): { full_name: string } | null {
  if (!r.clients) return null
  return Array.isArray(r.clients) ? (r.clients[0] ?? null) : r.clients
}

function getVehicle(r: Reservation): { brand: string; model: string; plates: string } | null {
  if (!r.vehicles) return null
  return Array.isArray(r.vehicles) ? (r.vehicles[0] ?? null) : r.vehicles
}

interface Props {
  searchParams: Promise<{ mes?: string; q?: string }>
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function parseMonth(mes?: string): { year: number; month: number } {
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number)
    return { year: y, month: m }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function dayStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDayOfWeek(year: number, month: number, day: number) {
  return new Date(`${dayStr(year, month, day)}T12:00:00Z`).getUTCDay()
}

export default async function CalendarioReservasPage({ searchParams }: Props) {
  const { mes, q } = await searchParams
  const { year, month } = parseMonth(mes)
  const quincena = q === '2' ? 2 : 1

  const totalDays  = daysInMonth(year, month)
  const startDay   = quincena === 1 ? 1 : 16
  const endDay     = quincena === 1 ? 15 : totalDays
  const days       = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i)

  const firstDate  = dayStr(year, month, startDay)
  const lastDate   = dayStr(year, month, endDay)

  // Month navigation
  const prevMonth = month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`
  const nextMonth = month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`

  const now       = new Date()
  const thisMes   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthName = new Date(`${year}-${String(month).padStart(2, '0')}-15`)
    .toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Fetch reservations that overlap the visible range
  const { data: reservations } = await supabase
    .from('reservations')
    .select(`
      id, start_date, end_date, status,
      clients ( full_name ),
      vehicles ( brand, model, plates )
    `)
    .eq('tenant_id', profile.tenant_id)
    .not('status', 'in', '("cancelled")')
    .lte('start_date', lastDate)
    .gte('end_date',   firstDate)
    .order('start_date') as { data: Reservation[] | null }

  // Group reservations by day
  const byDay: Record<number, Reservation[]> = {}
  for (const day of days) byDay[day] = []

  for (const r of (reservations ?? []) as Reservation[]) {
    for (const day of days) {
      const d = dayStr(year, month, day)
      if (r.start_date <= d && r.end_date >= d) {
        byDay[day].push(r)
      }
    }
  }

  const today = todayStr()

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link
            href="/dashboard/reservas"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Reservas
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 capitalize">{monthName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {reservations?.length ?? 0} reservas en este período
          </p>
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center gap-2">
          <Link
            href={`?mes=${prevMonth}&q=${quincena}`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            ← Anterior
          </Link>
          <Link
            href={`?mes=${thisMes}&q=1`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            Hoy
          </Link>
          <Link
            href={`?mes=${nextMonth}&q=${quincena}`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      {/* Quincena tabs */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href={`?mes=${mes ?? thisMes}&q=1`}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors border ${
            quincena === 1
              ? 'bg-blue-600 text-white border-blue-600'
              : 'text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          1 – 15
        </Link>
        <Link
          href={`?mes=${mes ?? thisMes}&q=2`}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors border ${
            quincena === 2
              ? 'bg-blue-600 text-white border-blue-600'
              : 'text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          16 – {totalDays}
        </Link>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'cancelled').map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[k]?.dot ?? 'bg-gray-400'}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(100px, 1fr))` }}
        >
          {/* Header de días */}
          {days.map((day) => {
            const d     = dayStr(year, month, day)
            const dow   = getDayOfWeek(year, month, day)
            const isToday = d === today
            const isWeekend = dow === 0 || dow === 6
            return (
              <div
                key={`h-${day}`}
                className={`px-3 py-2.5 text-center border-b border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/60' : 'bg-white'
                }`}
              >
                <p className="text-xs text-gray-400 uppercase tracking-wide">{DIAS_ES[dow]}</p>
                <p className={`text-lg font-semibold mt-0.5 ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                  {day}
                </p>
              </div>
            )
          })}

          {/* Celdas de días con reservas */}
          {days.map((day) => {
            const d       = dayStr(year, month, day)
            const dow     = getDayOfWeek(year, month, day)
            const isToday = d === today
            const isWeekend = dow === 0 || dow === 6
            const rsvs    = byDay[day] ?? []
            const MAX_VIS = 4
            const hidden  = rsvs.length - MAX_VIS

            return (
              <div
                key={`c-${day}`}
                className={`min-h-[120px] border-r border-gray-100 last:border-r-0 p-1.5 relative group ${
                  isToday ? 'bg-blue-50/30' : isWeekend ? 'bg-gray-50/40' : ''
                }`}
              >
                {/* Zona clicable para nueva reserva */}
                <Link
                  href={`/dashboard/reservas/nueva?start=${d}`}
                  className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 pointer-events-none"
                  aria-hidden="true"
                />

                {/* Píldoras de reservas */}
                <div className="space-y-1 relative z-10">
                  {rsvs.slice(0, MAX_VIS).map((r) => {
                    const col = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending
                    const cli = getClient(r)
                    const veh = getVehicle(r)
                    return (
                      <Link
                        key={r.id}
                        href={`/dashboard/reservas/${r.id}`}
                        className={`block w-full text-left px-2 py-1 rounded text-xs font-medium truncate ${col.bg} ${col.text} hover:brightness-95 transition-all`}
                        title={`${cli?.full_name} · ${veh?.brand} ${veh?.model} (${veh?.plates})`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${col.dot} mr-1 align-middle`} />
                        {cli?.full_name ?? '—'}
                      </Link>
                    )
                  })}
                  {hidden > 0 && (
                    <p className="text-xs text-gray-400 pl-2">+{hidden} más</p>
                  )}
                </div>

                {/* Hover: botón añadir */}
                <Link
                  href={`/dashboard/reservas/nueva?start=${d}`}
                  className="absolute bottom-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center"
                  title={`Nueva reserva el ${day}`}
                >
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </Link>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Pasa el mouse sobre un día y haz clic en + para crear una reserva · Clic en una reserva para verla
      </p>
    </div>
  )
}
