'use client'

import { useRouter } from 'next/navigation'

interface Vehicle {
  id: string
  brand: string
  model: string
  year: number
  plates: string
}

interface Reservation {
  id: string
  vehicle_id: string
  start_date: string
  end_date: string
  status: string
  clients: { full_name: string } | null
}

interface Block {
  id: string
  vehicle_id: string
  start_date: string
  end_date: string
  reason: string
}

interface Event {
  id: string
  type: 'reservation' | 'block'
  startDay: number  // índice 0-based en la ventana (clamped a 0)
  endDay: number    // exclusivo (clamped a `days`)
  label: string
  status?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-400 text-yellow-900 hover:bg-yellow-500',
  confirmed: 'bg-blue-500  text-white       hover:bg-blue-600',
  active:    'bg-green-500 text-white        hover:bg-green-600',
}

const REASON_LABELS: Record<string, string> = {
  maintenance: 'Mantenimiento',
  cleaning:    'Limpieza',
  repair:      'Reparación',
  custom:      'Bloqueado',
}

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function CalendarioGantt({
  vehicles,
  reservations,
  blocks,
  startDate,
  days = 14,
}: {
  vehicles: Vehicle[]
  reservations: Reservation[]
  blocks: Block[]
  startDate: string
  days?: number
}) {
  const router = useRouter()

  // Generar las fechas de las columnas
  const dates: string[] = Array.from({ length: days }, (_, i) => addDays(startDate, i))
  const today = new Date().toISOString().slice(0, 10)

  // Para un vehicleId, retorna los eventos ordenados y ajustados a la ventana
  function getEvents(vehicleId: string): Event[] {
    const events: Event[] = []

    for (const r of reservations) {
      if (r.vehicle_id !== vehicleId) continue
      const rStart = r.start_date.slice(0, 10)
      const rEnd   = r.end_date.slice(0, 10)

      // Primer día de la ventana que >= rStart
      let s = dates.findIndex(d => d >= rStart)
      if (s === -1) s = days          // empieza después de la ventana → ignorar
      if (rStart < dates[0]) s = 0   // empieza antes → clamp a 0

      // Primer día de la ventana que >= rEnd (= primer día libre)
      let e = dates.findIndex(d => d >= rEnd)
      if (e === -1) e = days          // termina después de la ventana → clamp a days

      if (s >= days || e <= 0 || e <= s) continue

      events.push({
        id: r.id,
        type: 'reservation',
        startDay: Math.max(0, s),
        endDay:   Math.min(days, e),
        label: (r.clients as { full_name: string } | null)?.full_name ?? 'Reserva',
        status: r.status,
      })
    }

    for (const b of blocks) {
      if (b.vehicle_id !== vehicleId) continue
      const bStart = b.start_date.slice(0, 10)
      const bEnd   = b.end_date.slice(0, 10)

      let s = dates.findIndex(d => d >= bStart)
      if (s === -1) s = days
      if (bStart < dates[0]) s = 0

      let e = dates.findIndex(d => d >= bEnd)
      if (e === -1) e = days

      if (s >= days || e <= 0 || e <= s) continue

      events.push({
        id: b.id,
        type: 'block',
        startDay: Math.max(0, s),
        endDay:   Math.min(days, e),
        label: REASON_LABELS[b.reason] ?? 'Bloqueado',
      })
    }

    return events.sort((a, b) => a.startDay - b.startDay)
  }

  function renderRow(vehicle: Vehicle) {
    const events = getEvents(vehicle.id)
    const cells: React.ReactNode[] = []
    let dayIdx = 0

    while (dayIdx < days) {
      const date = dates[dayIdx]
      const event = events.find(e => e.startDay <= dayIdx && e.endDay > dayIdx)

      if (event && event.startDay === dayIdx) {
        // Celda que arranca aquí y abarca varios días
        const span = event.endDay - event.startDay
        const colorClass = event.type === 'block'
          ? 'bg-red-400 text-white hover:bg-red-500'
          : (STATUS_COLORS[event.status ?? ''] ?? 'bg-blue-400 text-white hover:bg-blue-500')

        cells.push(
          <td
            key={`ev-${event.id}`}
            colSpan={span}
            title={event.label}
            className={`
              px-1 py-0 text-xs font-medium truncate cursor-pointer
              border-y border-r border-white transition-colors ${colorClass}
            `}
            onClick={() => {
              if (event.type === 'reservation') {
                router.push(`/dashboard/reservas/${event.id}`)
              }
            }}
          >
            <span className="block truncate px-1 py-2 leading-none">{event.label}</span>
          </td>
        )
        dayIdx += span
      } else {
        // Celda vacía — clickeable para crear reserva
        const isToday = date === today
        const endDateStr = addDays(date, 1)
        cells.push(
          <td
            key={`empty-${dayIdx}`}
            title={`Crear reserva: ${date}`}
            className={`
              border border-gray-100 cursor-pointer
              hover:bg-blue-50 transition-colors
              ${isToday ? 'bg-blue-50/60' : ''}
            `}
            onClick={() =>
              router.push(
                `/dashboard/reservas/nueva?start=${date}T10:00&end=${endDateStr}T10:00&vehicle=${vehicle.id}`
              )
            }
          />
        )
        dayIdx++
      }
    }

    return cells
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No hay vehículos activos.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="border-collapse text-sm"
        style={{ minWidth: `${192 + days * 48}px`, width: '100%' }}
      >
        {/* Encabezado de fechas */}
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 border-r border-gray-200 w-48 sticky left-0 bg-gray-50 z-10">
              Vehículo
            </th>
            {dates.map(date => {
              const d = new Date(date + 'T12:00:00Z')
              const isToday = date === today
              const isSun = d.getUTCDay() === 0
              const isSat = d.getUTCDay() === 6
              return (
                <th
                  key={date}
                  className={`
                    text-center px-0 py-1.5 text-xs border-r border-gray-200 w-12
                    ${isToday ? 'bg-blue-100 text-blue-700' : isSun || isSat ? 'bg-gray-100 text-gray-400' : 'text-gray-500'}
                  `}
                >
                  <div className="font-semibold leading-none">{d.getUTCDate()}</div>
                  <div className="text-gray-400 text-[10px] mt-0.5 capitalize">
                    {d.toLocaleDateString('es-DO', { weekday: 'short', timeZone: 'UTC' })}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>

        {/* Filas de vehículos */}
        <tbody>
          {vehicles.map(vehicle => (
            <tr key={vehicle.id} className="h-10 border-b border-gray-100">
              <td className="px-3 py-1 border-r border-gray-200 sticky left-0 bg-white z-10 w-48">
                <div className="font-medium text-gray-900 text-xs leading-tight">
                  {vehicle.brand} {vehicle.model} {vehicle.year}
                </div>
                <div className="text-gray-400 text-xs font-mono">{vehicle.plates}</div>
              </td>
              {renderRow(vehicle)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
