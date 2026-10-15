'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { rentalFolio, statusStyle } from '@/lib/rentalLabels'
import { sortRows, RENTAL_STATUS_RANK } from '@/lib/tableSort'
import { useTableSort } from '@/lib/useTableSort'
import { SortButtonTh } from '@/components/dashboard/SortableTh'

interface Reservation {
  id: string
  number: number | null
  origin: string
  status: string
  start_date: string
  end_date: string
  created_at: string
  vehicles: { brand: string; model: string; plates: string } | null
}

export default function RentalHistory({ clientId }: { clientId: string }) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const { sort, onSort } = useTableSort<'folio' | 'vehiculo' | 'periodo' | 'estado'>()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('tenant_id').eq('id', user.id).single()
        .then(({ data: profile }) => {
          if (!profile?.tenant_id) return
          supabase
            .from('reservations')
            .select('id, number, origin, status, start_date, end_date, created_at, vehicles ( brand, model, plates )')
            .eq('client_id', clientId)
            .eq('tenant_id', profile.tenant_id)
            .order('created_at', { ascending: false })
            .limit(20)
            .then(({ data }) => {
              setReservations((data ?? []) as unknown as Reservation[])
              setLoading(false)
            })
        })
    })
  }, [clientId])

  if (loading) {
    return (
      <div className="mx-6 mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Historial de rentas</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  const rows = sortRows(reservations, sort, {
    folio:    r => `${r.origin === 'walk_in' ? 'C' : 'R'}${String(r.number ?? 0).padStart(8, '0')}`,
    vehiculo: r => r.vehicles ? `${r.vehicles.brand} ${r.vehicles.model}` : null,
    periodo:  r => r.start_date,
    estado:   r => RENTAL_STATUS_RANK[r.status] ?? 99,
  })

  const nights = (r: Reservation) => Math.max(1, Math.ceil(
    (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24)
  ))

  return (
    <div className="mx-6 mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          Historial de rentas
          <span className="ml-2 text-xs text-gray-400 font-normal">{reservations.length} reserva{reservations.length !== 1 ? 's' : ''}</span>
        </h2>
      </div>

      {reservations.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          Este cliente no tiene reservas registradas.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <SortButtonTh label="No." sortKey="folio" sort={sort} onSort={onSort} />
              <SortButtonTh label="Vehículo" sortKey="vehiculo" sort={sort} onSort={onSort} />
              <SortButtonTh label="Período" sortKey="periodo" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
              <SortButtonTh label="Estado" sortKey="estado" sort={sort} onSort={onSort} />
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => {
              const v = r.vehicles
              const cfg = statusStyle(r.status, r.origin)
              return (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{rentalFolio(r.origin, r.number)}</td>
                  <td className="px-4 py-3">
                    {v ? (
                      <>
                        <p className="font-medium text-gray-900">{v.brand} {v.model}</p>
                        <p className="text-xs font-mono text-gray-400">{v.plates}</p>
                      </>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500">
                    <p>{new Date(r.start_date).toLocaleDateString('es-MX')} → {new Date(r.end_date).toLocaleDateString('es-MX')}</p>
                    <p className="text-gray-400">{nights(r)} día{nights(r) !== 1 ? 's' : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/reservas/${r.id}`} className="text-xs text-blue-600 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
