// src/app/dashboard/reservas/[id]/cambio-vehiculo/page.tsx
// Cambio de vehículo durante la renta: iniciar (vehículo, motivo, precio) y seguir el avance
// de la recepción del vehículo actual y la entrega del nuevo.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rentalFolio, rentalKind } from '@/lib/rentalLabels'
import { SWAP_REASONS, type SwapReason } from '@/lib/vehicleSwap'
import StartSwapForm from './StartSwapForm'
import CancelSwapButton from './CancelSwapButton'
import { fmtUSD } from '@/lib/currency'

interface Props { params: Promise<{ id: string }> }

type V = { brand: string; model: string; year: number; plates: string } | null
const vLabel = (v: V) => v ? `${v.brand} ${v.model} ${v.year} · ${v.plates}` : '—'
const money = (n: number | string | null) => fmtUSD(n)

export default async function CambioVehiculoPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) redirect('/login')

  const { data: rental } = await supabase
    .from('reservations')
    .select('id, number, origin, status, vehicles ( brand, model, year, plates ), clients ( full_name )')
    .eq('id', id).eq('tenant_id', profile.tenant_id).maybeSingle()
  if (!rental) redirect('/dashboard/reservas')

  const { data: swaps } = await supabase
    .from('reservation_vehicle_swaps')
    .select(`id, status, reason, keep_price, old_total, new_total, swap_at, completed_at, notes,
      from_vehicle:vehicles!reservation_vehicle_swaps_from_vehicle_id_fkey ( brand, model, year, plates ),
      to_vehicle:vehicles!reservation_vehicle_swaps_to_vehicle_id_fkey ( brand, model, year, plates )`)
    .eq('reservation_id', id).eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  const open = (swaps ?? []).find(s => s.status === 'in_progress')
  let openInspections = new Set<string>()
  if (open) {
    const { data: insp } = await supabase.from('inspections').select('type').eq('swap_id', open.id)
    openInspections = new Set((insp ?? []).map(i => i.type as string))
  }
  const one = <T,>(v: unknown) => (Array.isArray(v) ? v[0] : v) as T
  const current = one<V>(rental.vehicles)
  const folio = rentalFolio(rental.origin, rental.number)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/dashboard/reservas/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {rentalKind(rental.origin)} {folio}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Cambio de vehículo</h1>
        <p className="text-sm text-gray-500 mt-0.5">{one<{ full_name: string } | null>(rental.clients)?.full_name} · {vLabel(current)}</p>
      </div>

      {open ? (
        <div className="space-y-4">
          <div className="bg-white border border-blue-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Cambio en proceso</p>
                <p className="text-xs text-gray-500">
                  {SWAP_REASONS[open.reason as SwapReason]?.label} · {open.keep_price ? 'sin alterar precio' : `nuevo total ${money(open.new_total)}`}
                </p>
              </div>
              {openInspections.size === 0 && <CancelSwapButton swapId={open.id} />}
            </div>
            <ol className="space-y-3">
              {[
                { type: 'checkin',  n: 1, title: 'Recepción del vehículo actual', v: one<V>(open.from_vehicle), enabled: true },
                { type: 'checkout', n: 2, title: 'Entrega del vehículo nuevo',   v: one<V>(open.to_vehicle),   enabled: openInspections.has('checkin') },
              ].map(step => {
                const done = openInspections.has(step.type)
                return (
                  <li key={step.type} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {done ? '✓' : step.n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500">{vLabel(step.v)} · fotos, kilometraje, combustible y daños</p>
                    </div>
                    {!done && (step.enabled ? (
                      <Link href={`/dashboard/reservas/${id}/inspecciones/${step.type}?swap=${open.id}`}
                        className="text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
                        Registrar
                      </Link>
                    ) : <span className="text-xs text-gray-400">Primero la recepción</span>)}
                  </li>
                )
              })}
            </ol>
          </div>
          <p className="text-xs text-gray-500">
            Al registrar las dos inspecciones, la renta pasa al vehículo nuevo, se actualiza el estado de ambos vehículos
            {open.keep_price ? '' : ' y el total'}, y queda en el historial de cambios.
          </p>
        </div>
      ) : rental.status === 'active' ? (
        <StartSwapForm reservationId={id} currentVehicle={vLabel(current)} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
          Solo se puede cambiar el vehículo de una renta <span className="font-medium">en uso</span>.
        </div>
      )}

      {/* Cambios anteriores */}
      {(swaps ?? []).some(s => s.status !== 'in_progress') && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Cambios anteriores</h2>
          <ul className="space-y-2.5">
            {(swaps ?? []).filter(s => s.status !== 'in_progress').map(s => (
              <li key={s.id} className="text-sm">
                <p className="text-gray-900">
                  {vLabel(one<V>(s.from_vehicle))} → {vLabel(one<V>(s.to_vehicle))}
                  {s.status === 'cancelled' && <span className="ml-2 text-xs text-red-600">Cancelado</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {SWAP_REASONS[s.reason as SwapReason]?.label} · {new Date(s.swap_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                  {s.status === 'completed' && !s.keep_price && <> · total {money(s.old_total)} → {money(s.new_total)}</>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
