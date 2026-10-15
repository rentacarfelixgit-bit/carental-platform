// src/app/dashboard/reservas/calendario/dia/page.tsx
// Vista de un día: todos los eventos de agenda y todas las rentas (salidas, regresos y en curso),
// sin el límite de espacio de la celda del calendario mensual.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rentalFolio, statusStyle } from '@/lib/rentalLabels'
import { calendarFromQuery, dayViewHref } from '@/lib/calendarReturn'
import { EVENT_PEOPLE_SELECT, eventPeople, type CalendarEventRow, type CalendarEventType } from '@/lib/calendarEvents'
import EventChip from '../EventChip'
import DayAddMenu from '../DayAddMenu'

interface Props { searchParams: Promise<{ fecha?: string }> }

const pad2 = (n: number) => String(n).padStart(2, '0')
function shiftDay(fecha: string, delta: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}
const timeOf = (iso: string) => {
  const t = iso.slice(11, 16)
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
}

interface RentalRow {
  id: string; number: number; origin: string; status: string; start_date: string; end_date: string
  clients: { full_name: string } | null
  vehicles: { brand: string; model: string; plates: string } | null
}

export default async function CalendarioDiaPage({ searchParams }: Props) {
  const { fecha: raw } = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const fecha = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(new Date(`${raw}T12:00:00Z`).getTime()) ? raw : today
  const mes = fecha.slice(0, 7)
  const dia = Number(fecha.slice(8, 10))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const [{ data: rawRentals }, { data: rawEvents }] = await Promise.all([
    supabase
      .from('reservations')
      .select('id, number, origin, status, start_date, end_date, clients ( full_name ), vehicles ( brand, model, plates )')
      .eq('tenant_id', profile.tenant_id)
      .neq('status', 'cancelled')
      .lte('start_date', `${fecha}T23:59:59`)
      .gte('end_date', `${fecha}T00:00:00`)
      .order('start_date'),
    supabase
      .from('calendar_events')
      .select(`id, type, title, notes, event_date, event_time, reservation_id, done, ${EVENT_PEOPLE_SELECT},
        reservations ( number, origin, clients ( full_name ), vehicles ( brand, model, plates ) )`)
      .eq('tenant_id', profile.tenant_id)
      .eq('event_date', fecha)
      .order('done')
      .order('event_time', { ascending: true, nullsFirst: true }),
  ])

  const rentals = (rawRentals ?? []) as unknown as RentalRow[]
  const departures = rentals.filter(r => r.start_date.slice(0, 10) === fecha)
  const returns    = rentals.filter(r => r.end_date.slice(0, 10) === fecha && r.start_date.slice(0, 10) !== fecha)
  const ongoing    = rentals.filter(r => r.start_date.slice(0, 10) < fecha && r.end_date.slice(0, 10) > fecha)

  const events: CalendarEventRow[] = (rawEvents ?? []).map(e => {
    const r = e.reservations as unknown as {
      number: number; origin: string; clients: { full_name: string } | null
      vehicles: { brand: string; model: string; plates: string } | null
    } | null
    return {
      id: e.id, type: e.type as CalendarEventType, title: e.title, notes: e.notes,
      event_date: e.event_date, event_time: e.event_time, reservation_id: e.reservation_id, done: e.done,
      ...eventPeople(e as unknown as Record<string, unknown>),
      rental_label: r
        ? [rentalFolio(r.origin, r.number), r.clients?.full_name, r.vehicles ? `${r.vehicles.brand} ${r.vehicles.model} ${r.vehicles.plates}` : null].filter(Boolean).join(' · ')
        : null,
    }
  })
  const pendingEvents = events.filter(e => !e.done).length

  const title = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const back = calendarFromQuery(mes, dia, 'dia')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Encabezado y navegación */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <Link href={`/dashboard/reservas/calendario?mes=${mes}&dia=${dia}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Calendario del mes
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 first-letter:uppercase">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {departures.length} salida{departures.length !== 1 ? 's' : ''} · {returns.length} regreso{returns.length !== 1 ? 's' : ''} ·{' '}
            {ongoing.length} en curso · {pendingEvents} evento{pendingEvents !== 1 ? 's' : ''} pendiente{pendingEvents !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={dayViewHref(shiftDay(fecha, -1))} aria-label="Día anterior" className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">←</Link>
          <Link href={dayViewHref(today)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">Hoy</Link>
          <Link href={dayViewHref(shiftDay(fecha, 1))} aria-label="Día siguiente" className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">→</Link>
          <div className="ml-1"><DayAddMenu date={fecha} variant="mobile" returnVista="dia" /></div>
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Agenda" count={events.length} dot="bg-orange-500">
          {events.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {events.map(ev => (
                <li key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0"><EventChip event={ev} size="md" /></div>
                  {ev.rental_label && <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[45%]">{ev.rental_label}</span>}
                  {ev.done && ev.done_by_name && <span className="flex-shrink-0 text-xs text-green-700">✓ {ev.done_by_name}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-3 text-sm text-gray-400">Sin eventos. Usa + para agregar uno.</p>}
        </Section>

        <Section title="Salen este día" count={departures.length} dot="bg-green-500">
          <RentalList rows={departures} back={back} when="start" />
        </Section>

        <Section title="Regresan este día" count={returns.length} dot="bg-blue-500">
          <RentalList rows={returns} back={back} when="end" />
        </Section>

        <Section title="En curso" count={ongoing.length} dot="bg-gray-400">
          <RentalList rows={ongoing} back={back} when="none" />
        </Section>
      </div>
    </div>
  )
}

// ── Componentes de la vista ───────────────────────────────────────────────

function RentalList({ rows, when, back }: { rows: RentalRow[]; when: 'start' | 'end' | 'none'; back: string }) {
  return (
    rows.length > 0 ? (
      <ul className="divide-y divide-gray-100">
        {rows.map(r => {
          const st = statusStyle(r.status, r.origin)
          return (
            <li key={r.id}>
              <Link href={`/dashboard/reservas/${r.id}?${back}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="w-16 flex-shrink-0 text-xs font-medium text-gray-600">
                  {when === 'start' ? timeOf(r.start_date) : when === 'end' ? timeOf(r.end_date) : ''}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    {r.clients?.full_name ?? '—'}
                    <span className="ml-2 font-mono text-xs font-normal text-gray-400">{rentalFolio(r.origin, r.number)}</span>
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {r.vehicles ? `${r.vehicles.brand} ${r.vehicles.model} · ${r.vehicles.plates}` : '—'}
                    {when === 'none' && <> · regresa {new Date(r.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</>}
                  </span>
                </span>
                <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${st.className}`}>{st.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    ) : <p className="px-4 py-3 text-sm text-gray-400">Nada</p>
  )
}

function Section({ title, count, dot, children }: { title: string; count: number; dot: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      {children}
    </section>
  )
}

