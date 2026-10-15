// src/app/dashboard/reservas/[id]/page.tsx
// Detalle de reserva — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '../StatusBadge'
import ReservationActions from './ReservationActions'
import ContratoButton from './ContratoButton'
import { rentalFolio, rentalSection, rentalTitle } from '@/lib/rentalLabels'
import RentalEvents from '../calendario/RentalEvents'
import ChangeReturnDateButton from './ChangeReturnDateButton'
import { SWAP_REASONS, type SwapReason } from '@/lib/vehicleSwap'
import RentalEquipmentSection, { type RentalEquipmentRow, type RentalChargeRow } from './RentalEquipmentSection'
import { EVENT_PEOPLE_SELECT, eventPeople, type CalendarEventRow, type CalendarEventType } from '@/lib/calendarEvents'

const EXTRA_LABELS: Record<string, string> = {
  gps:          'GPS',
  baby_seat:    'Silla para bebé',
  extra_driver: 'Conductor adicional',
  custom:       'Extra personalizado',
}

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cambio?: string }>
}

export default async function ReservaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { cambio } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  const isAdmin = profile.role === 'admin'

  const [
    { data: reservation },
    { data: checkoutInspection },
    { data: checkinInspection },
    { data: rawEvents },
    { data: changes },
    { data: rawEquipment },
    { data: rawCharges },
    { data: openSwap },
  ] = await Promise.all([
    supabase
      .from('reservations')
      .select(`
        id, number, origin, start_date, end_date, status, notes, internal_notes, created_at, confirmed_at,
        total_amount, daily_rate, cash_payment, card_payment, payment_method,
        clients ( id, full_name, id_number, phone, email, license_number, passport_number, address, city, state, zip_code, local_phone, local_address ),
        vehicles ( id, plates, brand, model, year, color ),
        reservation_extras ( id, extra_type, description )
      `)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single(),
    supabase
      .from('inspections')
      .select('id')
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .eq('type', 'checkout')
      .is('swap_id', null)
      .maybeSingle(),
    supabase
      .from('inspections')
      .select('id')
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .eq('type', 'checkin')
      .is('swap_id', null)
      .maybeSingle(),
    supabase
      .from('calendar_events')
      .select(`id, type, title, notes, event_date, event_time, reservation_id, done, ${EVENT_PEOPLE_SELECT}`)
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('event_date')
      .order('event_time', { ascending: true, nullsFirst: true }),
    supabase
      .from('reservation_changes')
      .select('id, type, old_end_date, new_end_date, old_total, suggested_total, new_total, reason, details, created_at, creator:users!reservation_changes_created_by_fkey ( full_name )')
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('rental_equipment')
      .select(`id, assigned_at, returned_at, return_condition, return_notes,
        equipment_items ( code, type, name ),
        assigner:users!rental_equipment_assigned_by_fkey ( full_name ),
        returner:users!rental_equipment_returned_by_fkey ( full_name )`)
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('assigned_at'),
    supabase
      .from('rental_charges')
      .select('id, concept, amount, reason, photo_paths, created_at, creator:users!rental_charges_created_by_fkey ( full_name )')
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at'),
    supabase
      .from('reservation_vehicle_swaps')
      .select('id, to_vehicle:vehicles!reservation_vehicle_swaps_to_vehicle_id_fkey ( brand, model, plates )')
      .eq('reservation_id', id)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'in_progress')
      .maybeSingle(),
  ])

  if (!reservation) redirect('/dashboard/reservas')

  const hasCheckout = !!checkoutInspection
  const hasCheckin  = !!checkinInspection

  const client  = reservation.clients  as unknown as {
    id: string; full_name: string; id_number: string; phone: string | null; email: string | null;
    license_number: string | null; passport_number: string | null;
    address: string | null; city: string | null; state: string | null;
    zip_code: string | null; local_phone: string | null; local_address: string | null;
  } | null
  const vehicle = reservation.vehicles as unknown as { id: string; plates: string; brand: string; model: string; year: number; color: string } | null
  const extras  = (reservation.reservation_extras ?? []) as { id: string; extra_type: string; description: string | null }[]

  const section = rentalSection(reservation.origin)
  const rentalLabel = [rentalFolio(reservation.origin, reservation.number), client?.full_name, vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.plates}` : null]
    .filter(Boolean).join(' · ')
  const linkedEvents: CalendarEventRow[] = (rawEvents ?? []).map(e => ({
    id: e.id, title: e.title, notes: e.notes, event_date: e.event_date, event_time: e.event_time,
    reservation_id: e.reservation_id, done: e.done,
    ...eventPeople(e as unknown as Record<string, unknown>),
    type: e.type as CalendarEventType, rental_label: rentalLabel,
  }))
  const todayStr = new Date().toISOString().slice(0, 10)

  // ── Equipo entregado y cargos adicionales ───────────────────────────────
  const personName = (v: unknown) => {
    const o = (Array.isArray(v) ? v[0] : v) as { full_name?: string } | null
    return o?.full_name ?? null
  }
  const equipmentRows: RentalEquipmentRow[] = (rawEquipment ?? []).map(r => {
    const it = (Array.isArray(r.equipment_items) ? r.equipment_items[0] : r.equipment_items) as unknown as { code: string; type: string; name: string | null } | null
    return {
      id: r.id, code: it?.code ?? '—', type: it?.type ?? 'other', name: it?.name ?? null,
      assignedAt: r.assigned_at, assignedBy: personName(r.assigner),
      returnedAt: r.returned_at, returnedBy: personName(r.returner),
      condition: r.return_condition, returnNotes: r.return_notes,
    }
  })
  const chargePaths = (rawCharges ?? []).flatMap(c => (c.photo_paths ?? []) as string[])
  const signed: Record<string, string> = {}
  if (chargePaths.length) {
    const { data: urls } = await supabase.storage.from('inspection-photos').createSignedUrls(chargePaths, 3600)
    urls?.forEach(u => { if (u.path && u.signedUrl) signed[u.path] = u.signedUrl })
  }
  const chargeRows: RentalChargeRow[] = (rawCharges ?? []).map(c => ({
    id: c.id, concept: c.concept, amount: Number(c.amount), reason: c.reason,
    createdAt: c.created_at, createdBy: personName(c.creator),
    photos: ((c.photo_paths ?? []) as string[]).map(p => signed[p]).filter(Boolean),
  }))
  const chargesTotal = chargeRows.reduce((s, c) => s + c.amount, 0)
  const pendingEquipment = equipmentRows.filter(e => !e.returnedAt).length
  const isContract = reservation.origin === 'walk_in'

  const nights = Math.ceil(
    (new Date(reservation.end_date).getTime() - new Date(reservation.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <Link href={section.href} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {section.label}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {rentalTitle(reservation.origin, reservation.status)}
              <span className="ml-2 font-mono text-base text-gray-500">{rentalFolio(reservation.origin, reservation.number)}</span>
            </h1>
            {isContract && reservation.status === 'confirmed' && (
              <p className="text-sm text-gray-500 mt-0.5">Toma las fotos de salida y entrega el vehículo para pasarlo a &quot;En uso&quot;.</p>
            )}
          </div>
          <StatusBadge status={reservation.status} origin={reservation.origin} />
        </div>
      </div>

      {/* Cambio de vehículo: terminado / en proceso */}
      {cambio === 'ok' && !openSwap && (
        <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800">
          Cambio de vehículo completado. La renta ya está con {vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plates}` : 'el vehículo nuevo'}.
        </div>
      )}
      {openSwap && (() => {
        const tv = (Array.isArray(openSwap.to_vehicle) ? openSwap.to_vehicle[0] : openSwap.to_vehicle) as { brand: string; model: string; plates: string } | null
        return (
          <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Cambio de vehículo en proceso</span>
              {tv && <> → {tv.brand} {tv.model} · {tv.plates}</>}. Faltan las inspecciones.
            </p>
            <Link href={`/dashboard/reservas/${id}/cambio-vehiculo`} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
              Continuar
            </Link>
          </div>
        )
      })()}

      {/* Acciones de estado */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ReservationActions
          reservationId={reservation.id}
          currentStatus={reservation.status}
          origin={reservation.origin}
          pendingEquipment={pendingEquipment}
          isAdmin={isAdmin}
          hasCheckout={hasCheckout}
          hasCheckin={hasCheckin}
        />
        <Link
          href={`/dashboard/reservas/${reservation.id}/inspecciones`}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          Inspecciones
        </Link>
        {reservation.status === 'active' && !openSwap && (
          <Link
            href={`/dashboard/reservas/${reservation.id}/cambio-vehiculo`}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Cambiar vehículo
          </Link>
        )}
        {['pending', 'confirmed', 'active'].includes(reservation.status) && (
          <ChangeReturnDateButton
            reservationId={reservation.id}
            endDate={reservation.end_date}
            kindLabel={isContract ? 'renta' : 'reserva'}
          />
        )}
        <ContratoButton
          reservationId={reservation.id}
          client={client ? {
            id:              client.id,
            full_name:       client.full_name,
            license_number:  client.license_number,
            passport_number: client.passport_number,
            phone:           client.phone,
            address:         client.address,
            city:            client.city,
            state:           client.state,
            zip_code:        client.zip_code,
            local_phone:     client.local_phone,
            local_address:   client.local_address,
          } : null}
        />
      </div>

      <div className="space-y-4">
        {/* Periodo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Periodo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Salida</p>
              <p className="font-medium text-gray-900">{new Date(reservation.start_date).toLocaleString('es-MX')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Regreso</p>
              <p className="font-medium text-gray-900">{new Date(reservation.end_date).toLocaleString('es-MX')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 mt-3">
            <p className="text-xs text-gray-500">{nights} día{nights !== 1 ? 's' : ''}</p>
            {reservation.total_amount != null && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-base font-semibold text-gray-900">
                  RD${Number(reservation.total_amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
                {chargesTotal > 0 && (
                  <p className="text-xs text-gray-600">
                    + cargos RD${chargesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })} ={' '}
                    <span className="font-semibold text-gray-900">
                      RD${(Number(reservation.total_amount) + chargesTotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
                {(reservation.cash_payment != null || reservation.card_payment != null) && (
                  <p className="text-xs text-gray-500">
                    Abonos:
                    {reservation.cash_payment != null && <> efectivo RD${Number(reservation.cash_payment).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</>}
                    {reservation.cash_payment != null && reservation.card_payment != null && ' ·'}
                    {reservation.card_payment != null && <> tarjeta RD${Number(reservation.card_payment).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</>}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Historial de cambios (extensiones / adelantos del regreso) */}
        {changes && changes.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Historial de cambios</h2>
            <ul className="space-y-3">
              {changes.map(ch => {
                const who = (Array.isArray(ch.creator) ? ch.creator[0] : ch.creator) as { full_name: string } | null
                const det = (ch.details ?? {}) as { old_days?: number; new_days?: number; manually_adjusted?: boolean; kind?: string; swap_reason?: string; keep_price?: boolean; days_used?: number; days_remaining?: number }
                const fmtD = (d: string | null) => d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
                const fmtM = (n: number | string | null) => n == null ? '—' : `RD$${Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
                if (ch.type === 'vehicle_change') {
                  return (
                    <li key={ch.id} className="text-sm border-l-2 border-indigo-200 pl-3">
                      <p className="font-medium text-gray-900">
                        Cambio de vehículo
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          {SWAP_REASONS[det.swap_reason as SwapReason]?.label ?? ''}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        {det.keep_price
                          ? <>Sin alterar precio ({fmtM(ch.old_total)})</>
                          : <>{det.days_used} día(s) con el anterior · {det.days_remaining} con el nuevo · total {fmtM(ch.old_total)} → <span className="font-medium text-gray-900">{fmtM(ch.new_total)}</span></>}
                      </p>
                      {ch.reason && <p className="text-xs text-gray-500 italic">Notas: {ch.reason}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">{who?.full_name ?? '—'} · {fmtD(ch.created_at)}</p>
                    </li>
                  )
                }
                return (
                  <li key={ch.id} className="text-sm border-l-2 border-blue-200 pl-3">
                    <p className="font-medium text-gray-900">
                      {det.kind === 'early_return' ? 'Regreso adelantado' : 'Regreso extendido'}
                      <span className="ml-2 text-xs font-normal text-gray-500">{det.old_days} → {det.new_days} días</span>
                    </p>
                    <p className="text-xs text-gray-600">{fmtD(ch.old_end_date)} → {fmtD(ch.new_end_date)}</p>
                    <p className="text-xs text-gray-600">
                      Total {fmtM(ch.old_total)} → <span className="font-medium text-gray-900">{fmtM(ch.new_total)}</span>
                      {det.manually_adjusted && <span className="ml-1 text-amber-700">(sugerido {fmtM(ch.suggested_total)}, ajustado a mano)</span>}
                    </p>
                    {ch.reason && <p className="text-xs text-gray-500 italic">Motivo: {ch.reason}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">{who?.full_name ?? '—'} · {fmtD(ch.created_at)}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Cliente */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <h2 className="text-sm font-medium text-gray-700">Cliente</h2>
            {client && (
              <Link href={`/dashboard/clientes/${client.id}/editar`} className="text-xs text-blue-600 hover:underline">
                Ver perfil
              </Link>
            )}
          </div>
          {client ? (
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-900">{client.full_name}</p>
              <p className="text-gray-500 font-mono text-xs">{client.id_number}</p>
              {client.phone && <p className="text-gray-600">{client.phone}</p>}
              {client.email && <p className="text-gray-600 text-xs">{client.email}</p>}
            </div>
          ) : <p className="text-sm text-gray-400">—</p>}
        </div>

        {/* Vehículo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <h2 className="text-sm font-medium text-gray-700">Vehículo</h2>
            {vehicle && (
              <Link href={`/dashboard/flota/${vehicle.id}/editar`} className="text-xs text-blue-600 hover:underline">
                Ver en flota
              </Link>
            )}
          </div>
          {vehicle ? (
            <div className="text-sm space-y-0.5">
              <p className="font-medium text-gray-900">{vehicle.brand} {vehicle.model} {vehicle.year}</p>
              <p className="font-mono text-gray-500">{vehicle.plates}</p>
              <p className="text-gray-400 text-xs">{vehicle.color}</p>
            </div>
          ) : <p className="text-sm text-gray-400">—</p>}
        </div>

        {/* Equipo entregado y cargos adicionales */}
        <RentalEquipmentSection
          reservationId={reservation.id}
          tenantId={profile.tenant_id}
          status={reservation.status}
          equipment={equipmentRows}
          charges={chargeRows}
        />

        {/* Agenda: eventos ligados a esta renta */}
        <RentalEvents
          reservationId={reservation.id}
          rentalLabel={rentalLabel}
          events={linkedEvents}
          defaultDate={reservation.status === 'active' ? reservation.end_date.slice(0, 10) : todayStr}
        />

        {/* Extras */}
        {extras.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Extras</h2>
            <div className="flex flex-wrap gap-2">
              {extras.map(e => (
                <span key={e.id} className="inline-flex items-center px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg">
                  {EXTRA_LABELS[e.extra_type] ?? e.extra_type}
                  {e.description && ` — ${e.description}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        {reservation.notes && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Observaciones</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{reservation.notes}</p>
          </div>
        )}
        {reservation.internal_notes && (
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-amber-800 border-b border-amber-100 pb-3 mb-3">Notas internas</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{reservation.internal_notes}</p>
          </div>
        )}

        {/* Metadatos */}
        <div className="text-xs text-gray-400 space-y-0.5 pb-2">
          <p>{isContract ? 'Abierto' : 'Creada'} el {new Date(reservation.created_at).toLocaleString('es-MX')}</p>
          {!isContract && reservation.confirmed_at && (
            <p>Confirmada el {new Date(reservation.confirmed_at).toLocaleString('es-MX')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
