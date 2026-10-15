// src/lib/useTableSort.ts
// Hook para ordenar tablas en el navegador (datos ya cargados en memoria).
import { useState } from 'react'
import { nextSort, type SortState } from './tableSort'

export function useTableSort<K extends string>(initial: SortState<K> | null = null) {
  const [sort, setSort] = useState<SortState<K> | null>(initial)
  const onSort = (key: string) => setSort(s => nextSort(s, key as K))
  return { sort, onSort }
}
