// src/components/dashboard/SortableTh.tsx
// Encabezado de tabla ordenable. Sin 'use client' a propósito: SortLinkTh se usa en páginas de
// servidor (el orden va en la URL) y SortButtonTh dentro de componentes cliente (orden en memoria).

import Link from 'next/link'
import type { SortState } from '@/lib/tableSort'
import LinkPendingOverlay from './LinkPendingOverlay'

type Align = 'left' | 'right' | 'center'

interface BaseProps {
  label: string
  sortKey: string
  sort: SortState | null
  align?: Align
  /** Clases extra del <th> (p. ej. "hidden sm:table-cell", "w-40") */
  className?: string
}

const thBase = 'text-xs font-medium text-gray-500 px-4 py-3 select-none'
const alignCls: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' }
const innerAlign: Record<Align, string> = { left: '', right: 'flex-row-reverse', center: 'justify-center' }

function ariaSort(active: boolean, sort: SortState | null): 'ascending' | 'descending' | 'none' {
  if (!active || !sort) return 'none'
  return sort.dir === 'asc' ? 'ascending' : 'descending'
}

export function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <svg className={`w-3 h-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'}`}
      viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 1.5 9 5H3z" opacity={!active || dir === 'asc' ? 1 : 0.25} />
      <path d="M6 10.5 3 7h6z" opacity={!active || dir === 'desc' ? 1 : 0.25} />
    </svg>
  )
}

function Inner({ label, active, sort, align }: { label: string; active: boolean; sort: SortState | null; align: Align }) {
  return (
    <span className={`inline-flex items-center gap-1 ${innerAlign[align]}`}>
      <span className={active ? 'text-gray-800' : ''}>{label}</span>
      <SortIcon active={active} dir={sort?.dir} />
    </span>
  )
}

/** Para páginas de servidor: cada clic es un enlace con el nuevo orden en la URL. */
export function SortLinkTh({ label, sortKey, sort, align = 'left', className = '', href }: BaseProps & {
  /** Arma la URL con el orden siguiente (asc → desc → sin orden) */
  href: (next: SortState | null) => string
}) {
  const active = sort?.key === sortKey
  const next: SortState | null = !active ? { key: sortKey, dir: 'asc' } : sort!.dir === 'asc' ? { key: sortKey, dir: 'desc' } : null
  return (
    <th className={`${thBase} ${alignCls[align]} ${className}`} aria-sort={ariaSort(active, sort)}>
      <Link href={href(next)} scroll={false} className="group inline-flex hover:text-gray-800 transition-colors" title={`Ordenar por ${label.toLowerCase()}`}>
        <Inner label={label} active={active} sort={sort} align={align} />
        <LinkPendingOverlay label="Ordenando…" />
      </Link>
    </th>
  )
}

/** Para componentes cliente: ordena en memoria al hacer clic. */
export function SortButtonTh({ label, sortKey, sort, align = 'left', className = '', onSort }: BaseProps & {
  onSort: (key: string) => void
}) {
  const active = sort?.key === sortKey
  return (
    <th className={`${thBase} ${alignCls[align]} ${className}`} aria-sort={ariaSort(active, sort)}>
      <button type="button" onClick={() => onSort(sortKey)} className="group inline-flex hover:text-gray-800 transition-colors" title={`Ordenar por ${label.toLowerCase()}`}>
        <Inner label={label} active={active} sort={sort} align={align} />
      </button>
    </th>
  )
}
