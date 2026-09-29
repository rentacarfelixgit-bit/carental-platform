import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CalendarioGantt from './CalendarioGantt'

const DAYS = 14

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  searchParams: Promise<{ from?: string }>
}

export default async function CalendarioPage({ searchParams }: Props) {
  const { from } = await searchParams
  const startDate = (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) ? from : todayStr()
  const endDate   = addDays(startDate, DAYS)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const [{ data: vehicles }, { data: reservations }, { data: blocks }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, brand, model, year, plates')
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true)
      .order('brand'),
    supabase
      .from('reservations')
      .select('id, vehicle_id, start_date, end_date, status, clients(full_name)')
      .eq('tenant_id', profile.tenant_id)
      .not('status', 'in', '("cancelled","completed")')
      .lt('start_date', endDate)
      .gt('end_date', startDate),
    supabase
      .from('vehicle_blocks')
      .select('id, vehicle_id, start_date, end_date, reason')
      .eq('tenant_id', profile.tenant_id)
      .lt('start_date', endDate)
      .gt('end_date', startDate),
  ])

  const prevStart = addDays(startDate, -DAYS)
  const nextStart = addDays(startDate, DAYS)
  const today     = todayStr()

  // Month label for the header
  const d0 = new Date(startDate + 'T12:00:00Z')
  const d1 = new Date(addDays(startDate, DAYS - 1) + 'T12:00:00Z')
  const monthLabel = d0.toLocaleDateString('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const monthLabel2 = d0.getUTCMonth() !== d1.getUTCMonth()
    ? ` — ${d1.toLocaleDateString('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`
    : ''

  return (
    <div className="p-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link
            href="/dashboard/flota"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Flota
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 capitalize">
            {monthLabel}{monthLabel2}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vehicles?.length ?? 0} vehículos · Clic en un espacio libre para crear reserva
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`?from=${prevStart}`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            ← Anterior
          </Link>
          <Link
            href={`?from=${today}`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            Hoy
          </Link>
          <Link
            href={`?from=${nextStart}`}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Confirmada
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> En curso
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Bloqueado
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200 inline-block" /> Hoy
        </span>
      </div>

      {/* Gantt */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <CalendarioGantt
          vehicles={vehicles ?? []}
          reservations={(reservations ?? []) as never}
          blocks={blocks ?? []}
          startDate={startDate}
          days={DAYS}
        />
      </div>
    </div>
  )
}
