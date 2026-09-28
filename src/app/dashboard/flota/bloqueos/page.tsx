import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BlockForm from './BlockForm'
import DeleteBlockButton from './DeleteBlockButton'

const REASON_LABELS: Record<string, string> = {
  maintenance: 'Mantenimiento',
  cleaning:    'Limpieza',
  repair:      'Reparación',
  custom:      'Otro',
}

export default async function BloqueosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin'

  // Vehículos activos para el selector
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, plates')
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)
    .order('brand')

  // Bloqueos actuales y futuros
  const now = new Date().toISOString()
  const { data: blocks } = await supabase
    .from('vehicle_blocks')
    .select(`
      id, reason, notes, start_date, end_date,
      vehicles ( brand, model, year, plates )
    `)
    .eq('tenant_id', profile.tenant_id)
    .gte('end_date', now)
    .order('start_date')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard/flota" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Flota
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Bloqueos de vehículos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bloquea un vehículo por mantenimiento, limpieza u otro motivo sin crear una reserva.</p>
      </div>

      {/* Formulario — solo admins */}
      {isAdmin && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
            Nuevo bloqueo
          </h2>
          <BlockForm vehicles={vehicles ?? []} />
        </section>
      )}

      {/* Lista de bloqueos activos/futuros */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
          Bloqueos activos y programados
        </h2>

        {!blocks || blocks.length === 0 ? (
          <p className="text-sm text-gray-400">No hay bloqueos activos.</p>
        ) : (
          <div className="space-y-3">
            {blocks.map((b) => {
              const v = b.vehicles as unknown as { brand: string; model: string; year: number; plates: string } | null
              const start = new Date(b.start_date)
              const end   = new Date(b.end_date)
              const isNow = start <= new Date() && new Date() <= end

              return (
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {v?.brand} {v?.model} {v?.year}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{v?.plates}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isNow
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {isNow ? 'Activo ahora' : 'Programado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {REASON_LABELS[b.reason] ?? b.reason}
                      {b.notes ? ` — ${b.notes}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {start.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {end.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {isAdmin && <DeleteBlockButton blockId={b.id} />}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
