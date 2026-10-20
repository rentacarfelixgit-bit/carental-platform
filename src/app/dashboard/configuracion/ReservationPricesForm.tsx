'use client'

// src/app/dashboard/configuracion/ReservationPricesForm.tsx
// Catálogo de seguros, extras e impuestos del negocio (precios en US$).
// - Conceptos base: se puede cambiar su precio u ocultarlos.
// - Conceptos propios: se crean, renombran, cambian de tipo o se eliminan.
// Lo que esté visible aparece en Nueva reserva, Nuevo contrato, "Preparar contrato" y el contrato impreso.
// Las rentas ya creadas conservan sus conceptos tal como se eligieron.

import { useState, useTransition } from 'react'
import { saveReservationPrices } from './actions'
import {
  BUILTIN_ITEMS, KINDS_BY_GROUP, KIND_LABEL, MAX_CUSTOM_ITEMS,
  type PriceItem, type PriceGroup, type PriceKind, type ReservationPrices, type CustomPriceItem,
} from '@/lib/reservationPrices'

interface Props {
  /** Catálogo completo del negocio, incluidos los conceptos base ocultos */
  items: PriceItem[]
  hidden: string[]
  /** Conceptos del sistema eliminados (se pueden restaurar) */
  deleted: string[]
  prices: ReservationPrices
  canEdit: boolean
}

const GROUPS: { group: PriceGroup; title: string; hint: string; addLabel: string }[] = [
  { group: 'insurance', title: 'Seguros',   hint: 'Normalmente por día',                      addLabel: 'Agregar seguro' },
  { group: 'extra',     title: 'Extras',    hint: 'Cargo único o por día',                    addLabel: 'Agregar extra' },
  { group: 'tax',       title: 'Impuestos', hint: 'Porcentaje sobre renta + seguros, o monto fijo', addLabel: 'Agregar impuesto' },
]

const unitOf = (k: PriceKind) => k === 'pct' ? '%' : k === 'per_day' ? '/ día' : ''

function newKey() {
  const rnd = Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  return `c_${Date.now().toString(36).slice(-4)}${rnd}`.slice(0, 18)
}

export default function ReservationPricesForm({ items, hidden: initialHidden, deleted: initialDeleted, prices, canEdit }: Props) {
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set(initialDeleted))
  const builtins = BUILTIN_ITEMS.filter(b => !deleted.has(b.key))
  // Conceptos propios que ya están guardados (los recién agregados se quitan sin confirmar)
  const [savedCustomKeys, setSavedCustomKeys] = useState<Set<string>>(() => new Set(items.filter(i => i.custom).map(i => i.key)))
  const [confirmDelete, setConfirmDelete] = useState<{ key: string; label: string; builtin: boolean } | null>(null)
  const [custom, setCustom] = useState<CustomPriceItem[]>(
    () => items.filter(i => i.custom).map(({ key, group, label, kind }) => ({ key, group, label, kind })))
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(initialHidden))
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, String(v)])))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const disabled = !canEdit || pending
  const touch = () => { setSaved(false); setError('') }

  function changePrice(key: string, raw: string) {
    if (raw !== '' && !/^\d{0,7}(\.\d{0,2})?$/.test(raw)) return
    setValues(v => ({ ...v, [key]: raw })); touch()
  }
  function toggleHidden(key: string) {
    setHidden(h => { const n = new Set(h); if (n.has(key)) n.delete(key); else n.add(key); return n }); touch()
  }
  function addItem(group: PriceGroup) {
    if (custom.length >= MAX_CUSTOM_ITEMS) { setError(`Máximo ${MAX_CUSTOM_ITEMS} conceptos propios.`); return }
    setCustom(c => [...c, { key: newKey(), group, label: '', kind: KINDS_BY_GROUP[group][0] }]); touch()
  }
  function updateItem(key: string, patch: Partial<CustomPriceItem>) {
    setCustom(c => c.map(i => i.key === key ? { ...i, ...patch } : i)); touch()
  }
  /** Pide confirmación; un concepto recién agregado y sin guardar se quita directo */
  function askDelete(key: string, label: string, builtin: boolean) {
    if (!builtin && !savedCustomKeys.has(key)) {
      setCustom(c => c.filter(i => i.key !== key)); touch(); return
    }
    setConfirmDelete({ key, label: label || 'Concepto sin nombre', builtin })
  }

  /** Guarda el catálogo. `next` permite guardar un cambio inmediato (eliminar / restaurar). */
  function persist(next?: { custom?: CustomPriceItem[]; hidden?: Set<string>; deleted?: Set<string> }, onOk?: () => void) {
    const c = next?.custom ?? custom
    const h = next?.hidden ?? hidden
    const d = next?.deleted ?? deleted
    setError(''); setSaved(false)
    if (c.some(x => !x.label.trim())) { setError('Escribe el nombre de cada concepto nuevo (o elimínalo).'); return }
    const keys = [...BUILTIN_ITEMS.filter(b => !d.has(b.key)).map(b => b.key), ...c.map(x => x.key)]
    const payload = Object.fromEntries(keys.map(k => [k, values[k] === '' || values[k] == null ? 0 : Number(values[k])]))
    startTransition(async () => {
      const res = await saveReservationPrices({ prices: payload, custom: c, hidden: [...h], deleted: [...d] })
      if (res?.error) { setError(res.error); return }
      setCustom(c); setHidden(h); setDeleted(d)
      setSavedCustomKeys(new Set(c.map(x => x.key)))
      setSaved(true)
      onOk?.()
    })
  }

  function handleSave() { persist() }

  function doDelete() {
    if (!confirmDelete) return
    const { key, builtin } = confirmDelete
    if (builtin) {
      const d = new Set(deleted); d.add(key)
      const h = new Set(hidden); h.delete(key)
      persist({ deleted: d, hidden: h }, () => setConfirmDelete(null))
    } else {
      const h = new Set(hidden); h.delete(key)
      persist({ custom: custom.filter(i => i.key !== key), hidden: h }, () => setConfirmDelete(null))
    }
  }

  function restoreBuiltins() {
    persist({ deleted: new Set() })
  }

  const priceInput = (key: string) => (
    <input
      id={`price_${key}`} type="text" inputMode="decimal" placeholder="0.00"
      value={values[key] ?? ''} onChange={e => changePrice(key, e.target.value)} disabled={disabled}
      className="w-24 px-2 py-1.5 text-sm text-right text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
    />
  )

  return (
    <div className="space-y-5">
      {GROUPS.map(g => {
        const base = builtins.filter(i => i.group === g.group)
        const mine = custom.filter(i => i.group === g.group)
        return (
          <div key={g.group} className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-900">{g.title}</h3>
              <span className="text-xs text-gray-400">{g.hint}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {/* Conceptos base */}
              {base.map(item => {
                const isHidden = hidden.has(item.key)
                return (
                  <div key={item.key} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 ${isHidden ? 'bg-gray-50' : ''}`}>
                    <label htmlFor={`price_${item.key}`} className={`text-sm flex-1 min-w-40 ${isHidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {item.label}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {item.kind !== 'pct' && <span className="text-xs text-gray-400">US$</span>}
                      {priceInput(item.key)}
                      <span className="text-xs text-gray-400 w-10">{unitOf(item.kind)}</span>
                      {canEdit && (
                        <button type="button" onClick={() => toggleHidden(item.key)} disabled={pending}
                          title={isHidden ? 'Volver a mostrar en reservas y contratos' : 'Ocultar en reservas y contratos'}
                          className="ml-1 text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 w-20">
                          {isHidden ? 'Mostrar' : 'Ocultar'}
                        </button>
                      )}
                      {canEdit && (
                        <button type="button" onClick={() => askDelete(item.key, item.label, true)} disabled={pending}
                          title="Eliminar concepto (las rentas ya creadas lo conservan)"
                          className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 w-20">
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Conceptos propios */}
              {mine.map(item => (
                <div key={item.key} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 ${hidden.has(item.key) ? 'bg-gray-50' : savedCustomKeys.has(item.key) ? '' : 'bg-blue-50/40'}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-48">
                    {/* "Nuevo" solo mientras no se ha guardado */}
                    {!savedCustomKeys.has(item.key) && (
                      <span className="text-[10px] font-semibold uppercase text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Nuevo</span>
                    )}
                    <input
                      type="text" value={item.label} maxLength={80} disabled={disabled}
                      onChange={e => updateItem(item.key, { label: e.target.value })}
                      placeholder={g.group === 'insurance' ? 'Ej. Seg. de Cristales Premium' : g.group === 'extra' ? 'Ej. GPS / Navigator' : 'Ej. Cargo por servicio'}
                      className={`flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${hidden.has(item.key) ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select value={item.kind} disabled={disabled}
                      onChange={e => updateItem(item.key, { kind: e.target.value as PriceKind })}
                      className="px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {KINDS_BY_GROUP[g.group].map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                    {item.kind !== 'pct' && <span className="text-xs text-gray-400">US$</span>}
                    {priceInput(item.key)}
                    <span className="text-xs text-gray-400 w-10">{unitOf(item.kind)}</span>
                    {canEdit && (
                      <button type="button" onClick={() => toggleHidden(item.key)} disabled={pending}
                        title={hidden.has(item.key) ? 'Volver a mostrar en reservas y contratos' : 'Ocultar en reservas y contratos'}
                        className="ml-1 text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 w-20">
                        {hidden.has(item.key) ? 'Mostrar' : 'Ocultar'}
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" onClick={() => askDelete(item.key, item.label, false)} disabled={pending}
                        title="Eliminar concepto (las rentas ya creadas lo conservan)"
                        className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 w-20">
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {canEdit && (
                <div className="px-4 py-2.5">
                  <button type="button" onClick={() => addItem(g.group)} disabled={pending}
                    className="inline-flex items-center gap-1.5 text-[14px] text-blue-600 hover:text-blue-700 font-medium">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {g.addLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-gray-500">
        Lo visible aparece en Nueva reserva, Nuevo contrato, &ldquo;Preparar contrato&rdquo; y el contrato impreso.
        Ocultar o eliminar un concepto no cambia las rentas ya creadas: conservan sus conceptos y precios.
      </p>

      {canEdit && deleted.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{deleted.size} concepto{deleted.size !== 1 ? 's' : ''} del sistema eliminado{deleted.size !== 1 ? 's' : ''}.</span>
          <button type="button" onClick={restoreBuiltins} disabled={pending}
            className="text-blue-600 hover:text-blue-700 font-medium underline-offset-2 hover:underline">
            Restaurar
          </button>
        </div>
      )}

      {/* Confirmación de eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !pending) setConfirmDelete(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="del-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </span>
              <div>
                <h3 id="del-title" className="text-base font-semibold text-gray-900">¿Eliminar &ldquo;{confirmDelete.label}&rdquo;?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Dejará de aparecer en nuevas reservas, contratos y en &ldquo;Preparar contrato&rdquo;.
                  Las rentas que ya lo tienen lo conservan con su precio y su contrato se imprime igual.
                </p>
                {confirmDelete.builtin && (
                  <p className="text-xs text-gray-500 mt-2">Es un concepto del sistema: podrás restaurarlo después desde esta misma pantalla.</p>
                )}
                {!confirmDelete.builtin && (
                  <p className="text-xs text-gray-500 mt-2">Esta acción no se puede deshacer; si lo necesitas de nuevo tendrás que crearlo otra vez.</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Se guardarán también los demás cambios de esta pantalla.</p>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={pending}
                className="px-4 py-2 text-[14px] text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={doDelete} disabled={pending}
                className="px-4 py-2 text-[14px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                {pending ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleSave} disabled={pending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {pending ? 'Guardando...' : 'Guardar precios y conceptos'}
          </button>
          {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Solo un administrador puede modificar estos precios y conceptos.</p>
      )}
    </div>
  )
}
