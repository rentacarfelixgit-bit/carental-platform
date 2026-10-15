// src/lib/calendarEvents.ts
// Tipos de evento de agenda del calendario: nombre, color e ícono de cada uno.

export type CalendarEventType = 'scheduled_return' | 'equipment_return' | 'vehicle_change' | 'team_note' | 'other'

export interface EventTypeConfig {
  label: string
  /** Título sugerido al elegir el tipo */
  defaultTitle: string
  /** Clases para la "pastilla" del evento en el calendario */
  chip: string
  dot: string
  /** path de ícono outline 24x24 */
  icon: string
}

export const EVENT_TYPES: Record<CalendarEventType, EventTypeConfig> = {
  scheduled_return: {
    label: 'Retorno programado',
    defaultTitle: 'Retorno fuera de fecha',
    chip: 'bg-orange-50 text-orange-800 border border-orange-200',
    dot: 'bg-orange-500',
    icon: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
  },
  equipment_return: {
    label: 'Retorno de equipo',
    defaultTitle: 'Recoger equipo',
    chip: 'bg-teal-50 text-teal-800 border border-teal-200',
    dot: 'bg-teal-500',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  },
  vehicle_change: {
    label: 'Cambio de vehículo',
    defaultTitle: 'Cambio de vehículo',
    chip: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
    dot: 'bg-indigo-500',
    icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  },
  team_note: {
    label: 'Nota para el equipo',
    defaultTitle: 'Nota',
    chip: 'bg-amber-50 text-amber-800 border border-amber-200',
    dot: 'bg-amber-500',
    icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  },
  other: {
    label: 'Otro',
    defaultTitle: '',
    chip: 'bg-slate-50 text-slate-700 border border-slate-200',
    dot: 'bg-slate-400',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
}

export const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES) as CalendarEventType[]

export function eventTypeConfig(t: string | null | undefined): EventTypeConfig {
  return EVENT_TYPES[(t ?? 'other') as CalendarEventType] ?? EVENT_TYPES.other
}

/** "14:30:00" → "2:30 p. m." */
export function formatEventTime(t: string | null | undefined) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
}

/** Forma que el calendario y el modal comparten */
export interface CalendarEventRow {
  id: string
  type: CalendarEventType
  title: string
  notes: string | null
  event_date: string          // YYYY-MM-DD
  event_time: string | null   // HH:MM:SS
  reservation_id: string | null
  done: boolean
  /** Etiqueta de la renta ligada, ej. "R-0012 · Juan Pérez · Kia Rio ABC123" */
  rental_label?: string | null
  /** Quién lo creó / quién lo marcó como hecho (para saber quién hizo qué) */
  created_by_name?: string | null
  created_at?: string | null
  done_by_name?: string | null
  done_at?: string | null
}

/** Columnas extra para saber quién creó y quién completó cada evento (usar dentro de .select()) */
export const EVENT_PEOPLE_SELECT =
  'created_at, done_at, creator:users!calendar_events_created_by_fkey ( full_name ), done_user:users!calendar_events_done_by_fkey ( full_name )'

/** Extrae los nombres de creador / quien completó de una fila con EVENT_PEOPLE_SELECT */
export function eventPeople(e: Record<string, unknown>) {
  const name = (v: unknown) => {
    const o = Array.isArray(v) ? v[0] : v
    return (o && typeof o === 'object' && 'full_name' in o ? (o as { full_name: string }).full_name : null) ?? null
  }
  return {
    created_by_name: name(e.creator),
    created_at:      (e.created_at as string | null) ?? null,
    done_by_name:    name(e.done_user),
    done_at:         (e.done_at as string | null) ?? null,
  }
}
