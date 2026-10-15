'use client'

// src/app/dashboard/equipo/EquipmentInventory.tsx
// Tabla del inventario con filtros, alta de equipo y edición (solo admin).

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createEquipment, updateEquipment } from './actions'
import {
  EQUIPMENT_TYPES, EQUIPMENT_STATUS, EQUIPMENT_TYPE_KEYS, EQUIPMENT_STATUS_KEYS,
  type EquipmentType, type EquipmentStatus,
} from '@/lib/equipment'
import { sortRows } from '@/lib/tableSort'
import { useTableSort } from '@/lib/useTableSort'
import { SortButtonTh } from '@/components/dashboard/SortableTh'

export interface InventoryItem {
  id: string
  code: string
  type: string
  name: string | null
  status: string
  notes: string | null
  usageCount: number
  holder: { reservationId: string; folio: string; client: string; since: string; due: string } | null
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

export default function EquipmentInventory({ items, isAdmin }: { items: InventoryItem[]; isAdmin: boolean }) {
  const [status, setStatus] = useState<EquipmentStatus | ''>('')
  const [type, setType]     = useState<EquipmentType | ''>('')
  const [q, setQ]           = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const { sort, onSort } = useTableSort<'codigo' | 'tipo' | 'estado' | 'lotiene'>()

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1
    return c
  }, [items])

  const filtered = items.filter(it =>
    (!status || it.status === status) &&
    (!type || it.type === type) &&
    (!q.trim() || `${it.code} ${it.name ?? ''} ${it.holder?.client ?? ''} ${it.holder?.folio ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  )

  const rows = sortRows(filtered, sort, {
    codigo:  it => it.code,
    tipo:    it => EQUIPMENT_TYPES[it.type as EquipmentType]?.label ?? it.type,
    estado:  it => EQUIPMENT_STATUS[it.status as EquipmentStatus]?.label ?? it.status,
    lotiene: it => it.holder?.client ?? null,
  })

  return (
    <div className="space-y-4">
      {/* Resumen por estado */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStatus('')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${!status ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Todos <span className="opacity-70">({items.length})</span>
        </button>
        {EQUIPMENT_STATUS_KEYS.map(s => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${status === s ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {EQUIPMENT_STATUS[s].label} <span className="opacity-70">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Barra: búsqueda, tipo, alta */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código, cliente o folio…"
          className="flex-1 min-w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={type} onChange={e => setType(e.target.value as EquipmentType | '')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los tipos</option>
          {EQUIPMENT_TYPE_KEYS.map(t => <option key={t} value={t}>{EQUIPMENT_TYPES[t].label}</option>)}
        </select>
        {isAdmin && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar equipo
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortButtonTh label="Código" sortKey="codigo" sort={sort} onSort={onSort} />
                <SortButtonTh label="Tipo" sortKey="tipo" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                <SortButtonTh label="Estado" sortKey="estado" sort={sort} onSort={onSort} />
                <SortButtonTh label="Lo tiene" sortKey="lotiene" sort={sort} onSort={onSort} className="hidden md:table-cell" />
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(it => {
                const st = EQUIPMENT_STATUS[it.status as EquipmentStatus] ?? EQUIPMENT_STATUS.available
                return (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium text-gray-900">{it.code}</p>
                      {it.name && <p className="text-xs text-gray-500">{it.name}</p>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{EQUIPMENT_TYPES[it.type as EquipmentType]?.label ?? it.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${st.className}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs">
                      {it.holder ? (
                        <Link href={`/dashboard/reservas/${it.holder.reservationId}`} className="hover:underline">
                          <span className="font-mono text-gray-700">{it.holder.folio}</span>
                          <span className="text-gray-600"> · {it.holder.client}</span>
                          <span className="block text-gray-400">regresa {new Date(it.holder.due).toLocaleDateString('es-MX')}</span>
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <button type="button" onClick={() => setEditing(it)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-14 text-gray-400">
            <p className="text-sm">{items.length === 0 ? 'Aún no hay equipo registrado.' : 'Sin resultados con esos filtros.'}</p>
            {items.length === 0 && isAdmin && (
              <button type="button" onClick={() => setAdding(true)} className="text-sm text-blue-600 hover:underline mt-1">Agregar el primero</button>
            )}
          </div>
        )}
      </div>

      {adding && <NewEquipmentModal onClose={() => setAdding(false)} />}
      {editing && <EditEquipmentModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100"><h2 className="text-base font-semibold text-gray-900">{title}</h2></div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">{footer}</div>
      </div>
    </div>
  )
}

function NewEquipmentModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [type, setType] = useState<EquipmentType>('gps')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  function save() {
    setError('')
    start(async () => {
      const res = await createEquipment({ type, code, name, notes })
      if (res.error) { setError(res.error); return }
      router.refresh(); onClose()
    })
  }

  return (
    <Modal title="Agregar equipo" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} disabled={pending} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white">Cancelar</button>
      <button type="button" onClick={save} disabled={pending || !code.trim()} className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
        {pending ? 'Guardando…' : 'Agregar'}
      </button>
    </>}>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
        <select value={type} onChange={e => setType(e.target.value as EquipmentType)} disabled={pending} className={`${inputCls} bg-white`}>
          {EQUIPMENT_TYPE_KEYS.map(t => <option key={t} value={t}>{EQUIPMENT_TYPES[t].label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
        <input type="text" value={code} maxLength={30} disabled={pending}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
          placeholder={`Ej. ${EQUIPMENT_TYPES[type].prefix}-001`} className={`${inputCls} font-mono`} />
        <p className="mt-1 text-xs text-gray-400">El mismo código de la etiqueta física. No se puede repetir.</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre / modelo (opcional)</label>
        <input type="text" value={name} maxLength={100} disabled={pending} onChange={e => setName(e.target.value)}
          placeholder="Ej. Silla Graco grupo 1" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
        <textarea rows={2} value={notes} maxLength={1000} disabled={pending} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
      </div>
    </Modal>
  )
}

function EditEquipmentModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const router = useRouter()
  const assigned = item.status === 'assigned'
  const [status, setStatus] = useState(item.status === 'assigned' ? 'available' : item.status)
  const [name, setName] = useState(item.name ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  function save() {
    setError('')
    start(async () => {
      const res = await updateEquipment(item.id, { name, notes, status: status as 'available' | 'maintenance' | 'lost' | 'retired' })
      if (res.error) { setError(res.error); return }
      router.refresh(); onClose()
    })
  }

  return (
    <Modal title={`Editar ${item.code}`} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} disabled={pending} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white">Cancelar</button>
      <button type="button" onClick={save} disabled={pending} className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </>}>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <p className="text-xs text-gray-500">{EQUIPMENT_TYPES[item.type as EquipmentType]?.label} · usado en {item.usageCount} renta{item.usageCount !== 1 ? 's' : ''}</p>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
        {assigned ? (
          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            Entregado en {item.holder?.folio}. El estado cambia al registrar su devolución en la renta.
          </p>
        ) : (
          <select value={status} onChange={e => setStatus(e.target.value)} disabled={pending} className={`${inputCls} bg-white`}>
            {(['available', 'maintenance', 'lost', 'retired'] as EquipmentStatus[]).map(s => (
              <option key={s} value={s}>{EQUIPMENT_STATUS[s].label}</option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre / modelo</label>
        <input type="text" value={name} maxLength={100} disabled={pending} onChange={e => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
        <textarea rows={2} value={notes} maxLength={1000} disabled={pending} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
      </div>
    </Modal>
  )
}
