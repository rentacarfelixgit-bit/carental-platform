// src/app/dashboard/reservas/[id]/page.tsx
// Detalle de reserva — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '../StatusBadge'
import ReservationActions from './ReservationActions'

const EXTRA_LABELS: Record<string, string> = {
  gps:          'GPS',
  baby_seat:    'Silla para bebé',
  extra_driver: 'Conductor adicional',
  custom:       'Extra personalizado',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReservaDetailPage({ params }: Props) {
  const { id } = await params

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

  const { data: reservation } = await supabase
    .from('reservations')
    .select(`
      id, start_date, end_date, status, notes, created_at, confirmed_at,
      clients ( id, full_name, id_number, phone, email ),
      vehicles ( id, plates, brand, model, year, color ),
      reservation_extras ( id, extra_type, description )
    `)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!reservation) redirect('/dashboard/reservas')

  const client  = reservation.clients  as unknown as { id: string; full_name: string; id_number: string; phone: string | null; email: string | null } | null
  const vehicle = reservation.vehicles as unknown as { id: string; plates: string; brand: string; model: string; year: number; color: string } | null
  const extras  = (reservation.reservation_extras ?? []) as { id: string; extra_type: string; description: string | null }[]

  const nights = Math.ceil(
    (new Date(reservation.end_date).getTime() - new Date(reservation.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <Link href="/dashboard/reservas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Reservas
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reserva</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{reservation.id}</p>
          </div>
          <StatusBadge status={reservation.status} />
        </div>
      </div>

      {/* Acciones de estado */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ReservationActions
          reservationId={reservation.id}
          currentStatus={reservation.status}
          isAdmin={isAdmin}
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
        <Link
          href={`/print/reservas/${reservation.id}/contrato`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Contrato
        </Link>
      </div>

      <div className="space-y-4">
        {/* Periodo */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Periodo</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Salida</p>
              <p className="font-medium text-gray-900">{new Date(reservation.start_date).toLocaleString('es-MX')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Regreso</p>
              <p className="font-medium text-gray-900">{new Date(reservation.end_date).toLocaleString('es-MX')}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">{nights} día{nights !== 1 ? 's' : ''}</p>
        </div>

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
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3 mb-3">Notas</h2>
            <p className="text-sm text-gray-600">{reservation.notes}</p>
          </div>
        )}

        {/* Metadatos */}
        <div className="text-xs text-gray-400 space-y-0.5 pb-2">
          <p>Creada el {new Date(reservation.created_at).toLocaleString('es-MX')}</p>
          {reservation.confirmed_at && (
            <p>Confirmada el {new Date(reservation.confirmed_at).toLocaleString('es-MX')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
