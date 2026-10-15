'use client'

// src/app/dashboard/reservas/[id]/RentalEquipmentSection.tsx
// Equipo entregado en la renta (por código), su devolución y los cargos adicionales
// documentados (motivo + fotos) que luego aparecen en el contrato.

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  listAvailableEquipment, assignEquipment, unassignEquipment, returnEquipment, addRentalCharge,
} from '../../equipo/actions'
import {
  EQUIPMENT_TYPES, EQUIPMENT_CONDITION, equipmentLabel,
  type EquipmentCondition, type EquipmentType,
} from '@/lib/equipment'

export interface RentalEquipmentRow {
  id: string
  code: string
  type: string
  name: string | null
  assignedAt: string
  assignedBy: string | null
  returnedAt: string | null
  returnedBy: string | null
  condition: string | null
  returnNotes: string | null
}

export interface RentalChargeRow {
  id: string
  concept: string
  amount: number
  reason: string
  createdAt: string
  createdBy: string | null
  photos: string[]   // signed URLs
}

interface Props {
  reservationId: string
  tenantId: string
  status: string
  equipment: RentalEquipmentRow[]
  charges: RentalChargeRow[]
}

const money = (n: number) => `RD$${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt = (d: string) => new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

export default function RentalEquipmentSection({ reservationId, tenantId, status, equipment, charges }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [assigning, setAssigning] = useState(false)
  const [available, setAvailable] = useState<{ id: string; code: string; type: string; name: string | null }[] | null>(null)
  const [pick, setPick] = useState('')
  const [returning, setReturning] = useState<RentalEquipmentRow | null>(null)
  const [addingCharge, setAddingCharge] = useState(false)

  const open = ['pending', 'confirmed', 'active'].includes(status)
  const canRemove = status === 'pending' || status === 'confirmed'
  const pendingReturn = equipment.filter(e => !e.returnedAt).length
  const chargesTotal = charges.reduce((s, c) => s + c.amount, 0)

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError('')
    start(async () => {
      const res = await fn()
      if (res?.error) { setError(res.error); return }
      after?.()
      router.refresh()
    })
  }

  async function openAssign() {
    setAssigning(true); setPick('')
    setAvailable(null)
    setAvailable(await listAvailableEquipment())
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
        <h2 className="text-sm font-medium text-gray-700">
          Equipo y cargos
          {pendingReturn > 0 && (
            <span className="ml-2 text-xs font-normal text-orange-600">{pendingReturn} sin devolver</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {open && !assigning && (
            <button type="button" onClick={openAssign} className="text-xs text-blue-600 hover:underline">+ Entregar equipo</button>
          )}
          <button type="button" onClick={() => setAddingCharge(true)} className="text-xs text-blue-600 hover:underline">+ Agregar cargo</button>
        </div>
      </div>

      {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Entregar equipo */}
      {assigning && (
        <div className="mb-3 p-3 rounded-lg border border-blue-100 bg-blue-50/50 flex flex-wrap items-center gap-2">
          <select value={pick} onChange={e => setPick(e.target.value)} disabled={pending || available === null}
            className="flex-1 min-w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{available === null ? 'Cargando equipo disponible…' : available.length ? '— Elige el código —' : 'No hay equipo disponible'}</option>
            {(available ?? []).map(a => <option key={a.id} value={a.id}>{equipmentLabel(a.type, a.code, a.name)}</option>)}
          </select>
          <button type="button" disabled={!pick || pending}
            onClick={() => run(() => assignEquipment(reservationId, pick), () => { setAssigning(false); setPick('') })}
            className="text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
            {pending ? 'Guardando…' : 'Entregar'}
          </button>
          <button type="button" onClick={() => setAssigning(false)} className="text-sm px-3 py-2 text-gray-500 hover:text-gray-700">Cancelar</button>
        </div>
      )}

      {/* Lista de equipo */}
      {equipment.length > 0 ? (
        <ul className="divide-y divide-gray-100 mb-1">
          {equipment.map(e => {
            const cond = e.condition ? EQUIPMENT_CONDITION[e.condition as EquipmentCondition] : null
            return (
              <li key={e.id} className="py-2.5 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-mono font-medium">{e.code}</span>
                    <span className="text-gray-500"> · {e.name || EQUIPMENT_TYPES[e.type as EquipmentType]?.label}</span>
                  </p>
                  <p className="text-[11px] text-gray-400">Entregado por {e.assignedBy ?? '—'} · {fmt(e.assignedAt)}</p>
                  {e.returnedAt && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {cond && <span className={`inline-flex px-1.5 py-0.5 rounded font-medium mr-1 ${cond.className}`}>{cond.label}</span>}
                      Recibido por {e.returnedBy ?? '—'} · {fmt(e.returnedAt)}
                      {e.returnNotes && <span className="block italic">“{e.returnNotes}”</span>}
                    </p>
                  )}
                </div>
                {!e.returnedAt && (
                  <div className="flex items-center gap-2">
                    {canRemove && (
                      <button type="button" disabled={pending}
                        onClick={() => { if (confirm(`¿Quitar ${e.code} de esta renta?`)) run(() => unassignEquipment(e.id)) }}
                        className="text-xs px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                        Quitar
                      </button>
                    )}
                    {status !== 'pending' && (
                      <button type="button" onClick={() => setReturning(e)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
                        Registrar devolución
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        !assigning && <p className="text-sm text-gray-400">Sin equipo entregado.</p>
      )}

      {/* Cargos */}
      {charges.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-xs font-medium text-gray-600">Cargos adicionales</p>
            <p className="text-sm font-semibold text-gray-900">{money(chargesTotal)}</p>
          </div>
          <ul className="space-y-2.5">
            {charges.map(c => (
              <li key={c.id} className="text-sm border-l-2 border-red-200 pl-3">
                <div className="flex justify-between gap-3">
                  <p className="font-medium text-gray-900">{c.concept}</p>
                  <p className="font-medium text-gray-900 whitespace-nowrap">{money(c.amount)}</p>
                </div>
                <p className="text-xs text-gray-600">{c.reason}</p>
                {c.photos.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {c.photos.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block w-16 h-12 rounded overflow-hidden bg-gray-100 hover:opacity-90">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">{c.createdBy ?? '—'} · {fmt(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {returning && (
        <ReturnModal
          row={returning}
          tenantId={tenantId}
          onClose={() => setReturning(null)}
        />
      )}
      {addingCharge && (
        <ChargeModal reservationId={reservationId} tenantId={tenantId} onClose={() => setAddingCharge(false)} />
      )}
    </div>
  )
}

// ── Fotos de evidencia (se suben a inspection-photos/<tenant>/charges/…) ─────

function useChargePhotos(tenantId: string) {
  const [photos, setPhotos] = useState<{ key: number; url: string; path: string | null; error?: boolean }[]>([])
  const folder = useRef(`${tenantId}/charges/${crypto.randomUUID()}`)
  const seq = useRef(0)
  const supabase = createClient()

  async function add(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files).slice(0, 10)
    const items = list.map(f => ({ key: ++seq.current, url: URL.createObjectURL(f), path: null as string | null }))
    setPhotos(p => [...p, ...items])
    await Promise.all(list.map(async (file, i) => {
      const blob = await compress(file)
      const path = `${folder.current}/${Date.now()}_${i}.jpg`
      const { error } = await supabase.storage.from('inspection-photos').upload(path, blob, { contentType: 'image/jpeg' })
      setPhotos(p => p.map(x => x.key === items[i].key ? { ...x, path: error ? null : path, error: !!error } : x))
    }))
  }
  const remove = (key: number) => setPhotos(p => p.filter(x => x.key !== key))
  const uploading = photos.some(p => !p.path && !p.error)
  return { photos, add, remove, uploading, paths: photos.filter(p => p.path).map(p => p.path as string) }
}

function compress(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200; let { width: w, height: h } = img
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX } else { w = Math.round(w * MAX / h); h = MAX } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      c.toBlob(b => resolve(b ?? file), 'image/jpeg', 0.78)
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

function PhotoPicker({ state }: { state: ReturnType<typeof useChargePhotos> }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Fotos de evidencia</label>
      <div className="flex flex-wrap gap-2">
        {state.photos.map(p => (
          <div key={p.key} className="relative w-16 h-12 rounded overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            {!p.path && !p.error && <div className="absolute inset-0 bg-black/40" />}
            {p.error && <div className="absolute inset-0 bg-red-500/60" />}
            <button type="button" onClick={() => state.remove(p.key)} aria-label="Quitar foto"
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] leading-none">×</button>
          </div>
        ))}
        <button type="button" onClick={() => input.current?.click()}
          className="w-16 h-12 rounded border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 text-lg">+</button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple capture="environment" className="hidden"
        onChange={e => { state.add(e.target.files); e.target.value = '' }} />
      <p className="mt-1 text-[11px] text-gray-400">Recomendado: sustentan el cargo si el cliente lo reclama con su banco.</p>
    </div>
  )
}

function ModalShell({ title, subtitle, onClose, children, footer }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">{footer}</div>
      </div>
    </div>
  )
}

// ── Registrar devolución ────────────────────────────────────────────────────

function ReturnModal({ row, tenantId, onClose }: { row: RentalEquipmentRow; tenantId: string; onClose: () => void }) {
  const router = useRouter()
  const [condition, setCondition] = useState<EquipmentCondition>('ok')
  const [notes, setNotes] = useState('')
  const [charge, setCharge] = useState(true)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const photos = useChargePhotos(tenantId)
  const withCharge = condition !== 'ok' && charge

  function save() {
    setError('')
    start(async () => {
      const res = await returnEquipment(row.id, condition, notes,
        withCharge ? { amount: Number(amount), reason, photo_paths: photos.paths } : null)
      if (res.error) { setError(res.error); return }
      router.refresh(); onClose()
    })
  }

  const invalid = withCharge && (!amount || Number(amount) <= 0 || reason.trim().length < 3)

  return (
    <ModalShell title={`Devolución de ${row.code}`} subtitle={row.name || EQUIPMENT_TYPES[row.type as EquipmentType]?.label} onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} disabled={pending} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white">Cancelar</button>
        <button type="button" onClick={save} disabled={pending || invalid || photos.uploading}
          className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
          {pending ? 'Guardando…' : photos.uploading ? 'Subiendo fotos…' : 'Registrar'}
        </button>
      </>}>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div className="space-y-1.5">
        {(Object.keys(EQUIPMENT_CONDITION) as EquipmentCondition[]).map(c => (
          <label key={c} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${condition === c ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="radio" name="cond" checked={condition === c} onChange={() => setCondition(c)} className="accent-blue-600" />
            {EQUIPMENT_CONDITION[c].label}
          </label>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Notas {condition !== 'ok' && !withCharge && <span className="text-red-500">*</span>}
        </label>
        <textarea rows={2} value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} disabled={pending}
          placeholder={condition === 'ok' ? 'Opcional' : 'Ej. Pantalla rota, cable faltante…'} className={`${inputCls} resize-none`} />
      </div>
      {condition !== 'ok' && (
        <div className="rounded-lg border border-red-100 bg-red-50/40 p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" checked={charge} onChange={e => setCharge(e.target.checked)} className="accent-blue-600" />
            Cobrar al cliente (se agrega al contrato)
          </label>
          {charge && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">RD$</span>
                  <input type="text" inputMode="decimal" value={amount} disabled={pending}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v) }}
                    className={inputCls} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo del cargo *</label>
                <textarea rows={2} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} disabled={pending}
                  placeholder={condition === 'missing' ? 'Ej. El cliente no devolvió el equipo al cierre del contrato' : 'Ej. Equipo devuelto con la pantalla rota'}
                  className={`${inputCls} resize-none`} />
              </div>
              <PhotoPicker state={photos} />
            </>
          )}
        </div>
      )}
    </ModalShell>
  )
}

// ── Cargo libre ─────────────────────────────────────────────────────────────

function ChargeModal({ reservationId, tenantId, onClose }: { reservationId: string; tenantId: string; onClose: () => void }) {
  const router = useRouter()
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const photos = useChargePhotos(tenantId)

  function save() {
    setError('')
    start(async () => {
      const res = await addRentalCharge(reservationId, { concept, amount: Number(amount), reason, photo_paths: photos.paths })
      if (res.error) { setError(res.error); return }
      router.refresh(); onClose()
    })
  }
  const invalid = !concept.trim() || !amount || Number(amount) <= 0 || reason.trim().length < 3

  return (
    <ModalShell title="Agregar cargo" subtitle="Queda registrado con motivo, fotos y quién lo hizo, y aparece en el contrato." onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} disabled={pending} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white">Cancelar</button>
        <button type="button" onClick={save} disabled={pending || invalid || photos.uploading}
          className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
          {pending ? 'Guardando…' : photos.uploading ? 'Subiendo fotos…' : 'Agregar cargo'}
        </button>
      </>}>
      {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Concepto *</label>
        <input type="text" value={concept} maxLength={150} onChange={e => setConcept(e.target.value)} disabled={pending}
          placeholder="Ej. Limpieza profunda, multa de tránsito…" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">RD$</span>
          <input type="text" inputMode="decimal" value={amount} disabled={pending}
            onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v) }}
            className={inputCls} placeholder="0.00" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo *</label>
        <textarea rows={2} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} disabled={pending} className={`${inputCls} resize-none`} />
      </div>
      <PhotoPicker state={photos} />
    </ModalShell>
  )
}
