// src/lib/tableSort.ts
// Ordenamiento de tablas por columna, compartido por todas las listas del sistema.
//
// - Tablas paginadas en el servidor (reservas, contratos, clientes, flota, reportes): el orden
//   viaja en la URL (?orden=cliente&dir=asc) y se aplica en la consulta a Supabase, así ordena
//   TODOS los registros y no solo la página visible.
// - Tablas que ya tienen todos los datos en memoria (equipo, usuarios, historial): se ordenan
//   en el navegador con sortRows().
//
// Al hacer clic en un encabezado: ascendente → descendente → orden original.

export type SortDir = 'asc' | 'desc'
export interface SortState<K extends string = string> { key: K; dir: SortDir }

/** Lee el orden de la URL aceptando solo columnas permitidas (nunca se pasa texto libre a la consulta). */
export function parseSort<K extends string>(
  key: string | undefined,
  dir: string | undefined,
  allowed: readonly K[],
): SortState<K> | null {
  if (!key || !(allowed as readonly string[]).includes(key)) return null
  return { key: key as K, dir: dir === 'desc' ? 'desc' : 'asc' }
}

/** Siguiente estado al hacer clic en una columna: asc → desc → sin orden. */
export function nextSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> | null {
  if (!current || current.key !== key) return { key, dir: 'asc' }
  if (current.dir === 'asc') return { key, dir: 'desc' }
  return null
}

/** Escribe el orden en unos parámetros de URL (y regresa a la página 1). */
export function applySortParams(
  params: URLSearchParams,
  sort: SortState | null,
  names: { key: string; dir: string; page?: string } = { key: 'orden', dir: 'dir', page: 'page' },
) {
  params.delete(names.key)
  params.delete(names.dir)
  if (names.page) params.delete(names.page)
  if (sort) {
    params.set(names.key, sort.key)
    params.set(names.dir, sort.dir)
  }
  return params
}

type Sortable = string | number | boolean | null | undefined

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/** Compara dos valores: vacíos siempre al final, números como números y textos en español. */
export function compareValues(a: Sortable, b: Sortable): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

/** Ordena una copia de las filas. Los vacíos quedan al final en ambos sentidos. */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K> | null,
  getters: Record<K, (row: T) => Sortable>,
): T[] {
  if (!sort) return [...rows]
  const get = getters[sort.key]
  const sign = sort.dir === 'asc' ? 1 : -1
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((x, y) => {
      const xe = x.v === null || x.v === undefined || x.v === ''
      const ye = y.v === null || y.v === undefined || y.v === ''
      if (xe || ye) return xe === ye ? x.i - y.i : xe ? 1 : -1
      return compareValues(x.v, y.v) * sign || x.i - y.i
    })
    .map(x => x.row)
}

/** Orden lógico de los estados (no alfabético), para ordenar por "Estado". */
export const RENTAL_STATUS_RANK: Record<string, number> = {
  pending: 1, confirmed: 2, active: 3, completed: 4, cancelled: 5,
}

/**
 * Columnas de base de datos para el orden elegido, más el desempate.
 * Ej.: sortOrders(sort, { cliente: ['clients(full_name)'] }, [['created_at', false]])
 * Las columnas de tablas relacionadas usan la sintaxis de PostgREST "tabla(columna)".
 */
export function sortOrders<K extends string>(
  sort: SortState<K> | null,
  columns: Record<K, readonly string[]>,
  fallback: readonly (readonly [string, boolean])[],
): { column: string; ascending: boolean }[] {
  const out = sort ? columns[sort.key].map(column => ({ column, ascending: sort.dir === 'asc' })) : []
  for (const [column, ascending] of fallback) if (!out.some(o => o.column === column)) out.push({ column, ascending })
  return out
}

/** Columnas ordenables de las listas de rentas (reservas, contratos, reportes). */
export const RENTAL_SORT_KEYS = ['folio', 'cliente', 'vehiculo', 'fechas', 'estado'] as const
export type RentalSortKey = typeof RENTAL_SORT_KEYS[number]
export const RENTAL_SORT_COLUMNS: Record<RentalSortKey, readonly string[]> = {
  folio:    ['number'],
  cliente:  ['clients(full_name)'],
  vehiculo: ['vehicles(brand)', 'vehicles(model)'],
  fechas:   ['start_date'],
  estado:   ['status'],   // enum: pendiente → confirmada → en curso → completada → cancelada
}
