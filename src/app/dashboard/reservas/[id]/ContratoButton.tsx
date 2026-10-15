'use client'

// src/app/dashboard/reservas/[id]/ContratoButton.tsx
// Botón "Contrato": abre "Preparar contrato" precargado con los datos de la reserva.
// Todo lo capturado se guarda en la reserva/cliente y el contrato impreso lo lee de la base de datos,
// así que el PDF (y cualquier reimpresión) refleja exactamente la reserva.
// Seguros, extras e impuestos usan el mismo catálogo y el mismo cálculo que Nueva reserva.

import { useActionState, useRef, useState } from 'react'
import { saveContractDetails, type ContractDetailsState } from './contractActions'
import {
  INSURANCE_ITEMS, EXTRA_ITEMS, TAX_ITEMS, ALL_PRICE_ITEMS,
  computeBreakdown, selectionFromBreakdown,
  type PriceBreakdown, type PriceItem, type ReservationPrices,
} from '@/lib/reservationPrices'

export interface ClientForContrato {
  id: string
  full_name: string
  license_number: string | null
  passport_number: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  local_phone: string | null
  local_address: string | null
}

/** Datos de la reserva con los que se precarga el modal */
export interface ContractPrefill {
  days: number
  total_amount: number | null
  /** Desglose guardado (o reconstruido para reservas antiguas) */
  breakdown: PriceBreakdown
  /** false = reserva anterior al desglose: no se reescribe el total si no se tocan los precios */
  hasSavedBreakdown: boolean
  payment_method: string | null
  folio: string | null
  approval_number: string | null
  prepared_by: string | null
  d1_lic: string | null
  d1_tel: string | null
  d2_lic: string | null
  d2_tel: string | null
  driver_age: number | null
  pets: boolean
  deductible: number | null
}

interface Props {
  reservationId: string
  client: ClientForContrato | null
  contract: ContractPrefill
  /** Precios por defecto de Configuración (para conceptos que se marquen aquí por primera vez) */
  defaultPrices: ReservationPrices
}

const money = (n: number) => `RD$${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const unit = (it: PriceItem) => it.kind === 'per_day' ? '/día' : it.kind === 'pct' ? '%' : ''

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, disabled, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className="w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
    />
  )
}

function PriceInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      type="text" inputMode="decimal" placeholder="0.00" value={value} disabled={disabled}
      onChange={e => { const v = e.target.value; if (v === '' || /^\d{0,7}(\.\d{0,2})?$/.test(v)) onChange(v) }}
      className="w-full min-w-0 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs disabled:opacity-50"
    />
  )
}

export default function ContratoButton({ reservationId, client, contract, defaultPrices }: Props) {
  const [open, setOpen] = useState(false)
  const printWin = useRef<Window | null>(null)

  // ── Dirección (se guarda en la ficha del cliente) ────────────────────────
  const [address,      setAddress]      = useState(client?.address       ?? '')
  const [city,         setCity]         = useState(client?.city          ?? '')
  const [clientState,  setClientState]  = useState(client?.state         ?? '')
  const [zipCode,      setZipCode]      = useState(client?.zip_code      ?? '')
  const [localPhone,   setLocalPhone]   = useState(client?.local_phone   ?? '')
  const [localAddress, setLocalAddress] = useState(client?.local_address ?? '')

  // ── Detalles del contrato (se guardan en la reserva) ─────────────────────
  const [folio,        setFolio]        = useState(contract.folio ?? '')
  const [aprobacion,   setAprobacion]   = useState(contract.approval_number ?? '')
  const [preparadoPor, setPreparadoPor] = useState(contract.prepared_by ?? '')
  const [pago, setPago] = useState<'' | 'cash' | 'card' | 'mixed'>(
    contract.payment_method === 'cash' || contract.payment_method === 'card' || contract.payment_method === 'mixed'
      ? contract.payment_method : '')

  // ── Conductores: el 1 se precarga con la licencia y teléfono del cliente ─
  const [d1Lic, setD1Lic] = useState(contract.d1_lic ?? client?.license_number ?? '')
  const [d1Tel, setD1Tel] = useState(contract.d1_tel ?? client?.phone ?? '')
  const [d2Lic, setD2Lic] = useState(contract.d2_lic ?? '')
  const [d2Tel, setD2Tel] = useState(contract.d2_tel ?? '')
  const [edad,  setEdad]  = useState(contract.driver_age != null ? String(contract.driver_age) : '')
  const [mascotas, setMascotas] = useState(contract.pets)

  // ── Seguros, extras e impuestos (mismo catálogo que Nueva reserva) ───────
  const initial = selectionFromBreakdown(contract.breakdown, contract.days)
  const [checked, setChecked] = useState<Record<string, boolean>>(initial.checked)
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(
    ALL_PRICE_ITEMS.map(i => {
      const saved = initial.prices[i.key] || 0
      const v = saved > 0 ? saved : defaultPrices[i.key] ?? 0
      return [i.key, v ? String(v) : '']
    })))
  const [dailyRate, setDailyRate] = useState(initial.dailyRate ? String(initial.dailyRate) : '')
  const [otrosLabel,   setOtrosLabel]   = useState(initial.otros?.label ?? '')
  const [otrosPrice,   setOtrosPrice]   = useState(initial.otros?.price ? String(initial.otros.price) : '')
  const [otrosChecked, setOtrosChecked] = useState(initial.otros?.checked ?? false)
  const [deductible,   setDeductible]   = useState(contract.deductible != null ? String(contract.deductible) : '')
  const [pricingChanged, setPricingChanged] = useState(false)

  const touch = () => setPricingChanged(true)
  const toggle = (key: string, v: boolean) => { setChecked(p => ({ ...p, [key]: v })); touch() }
  const setPrice = (key: string, v: string) => { setPrices(p => ({ ...p, [key]: v })); touch() }

  const breakdown = computeBreakdown({
    days: contract.days,
    dailyRate: parseFloat(dailyRate) || 0,
    checked,
    prices: Object.fromEntries(ALL_PRICE_ITEMS.map(i => [i.key, parseFloat(prices[i.key] || '0') || 0])),
    otros: { label: otrosLabel, price: parseFloat(otrosPrice || '0') || 0, checked: otrosChecked },
  })
  const line = (key: string) => breakdown.lines.find(l => l.key === key)

  // Total que quedará en el contrato
  const savedTotal = contract.total_amount
  const finalTotal = pricingChanged || savedTotal == null ? breakdown.total : savedTotal
  const hasAdjustments = !pricingChanged && savedTotal != null && Math.abs(savedTotal - breakdown.total) >= 0.01

  const printUrl = `/print/reservas/${reservationId}/contrato`

  const [state, action, pending] = useActionState(
    async (prev: ContractDetailsState, fd: FormData): Promise<ContractDetailsState> => {
      const res = await saveContractDetails(prev, fd)
      if (res.success) {
        if (printWin.current && !printWin.current.closed) printWin.current.location.href = printUrl
        else window.open(printUrl, '_blank')
        setOpen(false)
        setPricingChanged(false)
      } else {
        printWin.current?.close()
      }
      printWin.current = null
      return res
    },
    {},
  )

  function handlePrintDirect() {
    window.open(printUrl, '_blank')
    setOpen(false)
  }

  const inp = 'w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
  const section = 'px-4 sm:px-6 py-4 space-y-3'
  const h3 = 'text-xs font-semibold text-gray-500 uppercase tracking-wide'

  return (
    <>
      {/* Botón de apertura */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
        </svg>
        Contrato
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 sm:pt-8 bg-gray-900/60 backdrop-blur-sm overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget && !pending) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Preparar contrato</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Precargado con los datos de la reserva. Lo que cambies aquí se guarda y sale en el contrato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              action={action}
              onSubmit={() => { printWin.current = window.open('about:blank', '_blank') }}
              className="divide-y divide-gray-100"
            >
              {/* Campos que se envían al servidor */}
              <input type="hidden" name="reservation_id"  value={reservationId} />
              <input type="hidden" name="address"         value={address} />
              <input type="hidden" name="city"            value={city} />
              <input type="hidden" name="state"           value={clientState} />
              <input type="hidden" name="zip_code"        value={zipCode} />
              <input type="hidden" name="local_phone"     value={localPhone} />
              <input type="hidden" name="local_address"   value={localAddress} />
              <input type="hidden" name="folio"           value={folio} />
              <input type="hidden" name="approval_number" value={aprobacion} />
              <input type="hidden" name="prepared_by"     value={preparadoPor} />
              <input type="hidden" name="payment_method"  value={pago} />
              <input type="hidden" name="d1_lic"          value={d1Lic} />
              <input type="hidden" name="d1_tel"          value={d1Tel} />
              <input type="hidden" name="d2_lic"          value={d2Lic} />
              <input type="hidden" name="d2_tel"          value={d2Tel} />
              <input type="hidden" name="driver_age"      value={edad} />
              <input type="hidden" name="pets"            value={mascotas ? '1' : '0'} />
              <input type="hidden" name="deductible"      value={deductible} />
              <input type="hidden" name="pricing_changed" value={pricingChanged ? '1' : '0'} />
              <input type="hidden" name="price_breakdown" value={JSON.stringify(breakdown)} />

              {/* Error del servidor */}
              {state.error && (
                <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {state.error}
                </div>
              )}

              {/* ── 1. Datos del cliente (solo lectura) ─────────────────────── */}
              <section className={section}>
                <h3 className={h3}>Datos del cliente</h3>
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Nombre</p>
                    <p className="font-medium text-gray-900">{client?.full_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Teléfono</p>
                    <p className="font-medium text-gray-900">{client?.phone ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Licencia</p>
                    <p className="font-medium text-gray-900">{client?.license_number ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Pasaporte</p>
                    <p className="font-medium text-gray-900">{client?.passport_number ?? '—'}</p>
                  </div>
                </div>
              </section>

              {/* ── 2. Dirección (se guarda en el cliente) ──────────────────── */}
              <section className={section}>
                <h3 className={h3}>Dirección del cliente</h3>
                <p className="text-xs text-gray-400">Estos datos se guardarán en el perfil del cliente.</p>
                <FieldRow label="Dirección">
                  <TextInput value={address} onChange={setAddress} placeholder="Calle / Av., #123" disabled={pending} maxLength={200} />
                </FieldRow>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FieldRow label="Ciudad">
                    <TextInput value={city} onChange={setCity} placeholder="Santiago" disabled={pending} maxLength={80} />
                  </FieldRow>
                  <FieldRow label="Estado / Provincia">
                    <TextInput value={clientState} onChange={setClientState} placeholder="Santiago" disabled={pending} maxLength={80} />
                  </FieldRow>
                  <FieldRow label="ZIP Code">
                    <TextInput value={zipCode} onChange={setZipCode} placeholder="51000" disabled={pending} maxLength={20} />
                  </FieldRow>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldRow label="Teléfono de contacto local">
                    <TextInput value={localPhone} onChange={setLocalPhone} placeholder="809-000-0000" disabled={pending} maxLength={30} />
                  </FieldRow>
                  <FieldRow label="Dirección local">
                    <TextInput value={localAddress} onChange={setLocalAddress} placeholder="Hotel / Airbnb..." disabled={pending} maxLength={200} />
                  </FieldRow>
                </div>
              </section>

              {/* ── 3. Detalles del contrato ─────────────────────────────────── */}
              <section className={section}>
                <h3 className={h3}>Detalles del contrato</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldRow label="Folio del depósito">
                    <TextInput value={folio} onChange={setFolio} placeholder="F-001" disabled={pending} maxLength={50} />
                  </FieldRow>
                  <FieldRow label="Número de aprobación">
                    <TextInput value={aprobacion} onChange={setAprobacion} placeholder="APR-00001" disabled={pending} maxLength={50} />
                  </FieldRow>
                </div>
                <FieldRow label="Preparado por">
                  <TextInput value={preparadoPor} onChange={setPreparadoPor} placeholder="Nombre del agente" disabled={pending} maxLength={100} />
                </FieldRow>
                <FieldRow label="Forma de pago">
                  <div className="flex flex-wrap gap-4 mt-1">
                    {([['cash', 'Efectivo'], ['card', 'Tarjeta'], ['mixed', 'Efectivo y tarjeta']] as const).map(([v, label]) => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="radio" name="pago_ui" value={v} checked={pago === v} onChange={() => setPago(v)}
                          disabled={pending} className="accent-blue-600" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                    {pago && (
                      <button type="button" onClick={() => setPago('')} className="text-xs text-gray-400 hover:text-gray-600">
                        Limpiar
                      </button>
                    )}
                  </div>
                </FieldRow>
              </section>

              {/* ── 4. Conductores ───────────────────────────────────────────── */}
              <section className={section}>
                <h3 className={h3}>Conductores</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldRow label="Conductor 1 — Licencia">
                    <TextInput value={d1Lic} onChange={setD1Lic} placeholder="L-12345678" disabled={pending} maxLength={30} />
                  </FieldRow>
                  <FieldRow label="Conductor 1 — Teléfono">
                    <TextInput value={d1Tel} onChange={setD1Tel} placeholder="809-000-0000" disabled={pending} maxLength={30} />
                  </FieldRow>
                  <FieldRow label="Conductor 2 — Licencia">
                    <TextInput value={d2Lic} onChange={setD2Lic} placeholder="L-12345678" disabled={pending} maxLength={30} />
                  </FieldRow>
                  <FieldRow label="Conductor 2 — Teléfono">
                    <TextInput value={d2Tel} onChange={setD2Tel} placeholder="809-000-0000" disabled={pending} maxLength={30} />
                  </FieldRow>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  <div className="flex-1">
                    <FieldRow label="Edad del conductor">
                      <input type="number" value={edad} onChange={e => setEdad(e.target.value.slice(0, 2))}
                        min={16} max={99} placeholder="25" disabled={pending} className={inp} />
                    </FieldRow>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none sm:pt-5">
                    <input type="checkbox" checked={mascotas} onChange={e => setMascotas(e.target.checked)}
                      disabled={pending} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">Cliente tiene mascotas</span>
                  </label>
                </div>
              </section>

              {/* ── 5. Seguros, extras e impuestos ───────────────────────────── */}
              <section className={section}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={h3}>Seguros, extras e impuestos</h3>
                  <span className="text-xs text-gray-400">{contract.days} día{contract.days !== 1 ? 's' : ''}</span>
                </div>

                {/* Tarifa */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 font-medium">Tarifa por día</span>
                  <span className="text-gray-400">RD$</span>
                  <div className="w-28">
                    <PriceInput value={dailyRate} onChange={v => { setDailyRate(v); touch() }} disabled={pending} />
                  </div>
                  <span className="ml-auto text-gray-500">Renta: <b className="text-gray-800">{money(breakdown.rental_subtotal)}</b></span>
                </div>

                {/* Seguros: aceptar / declinar */}
                <div className="rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Seguro</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 w-28 border-l border-gray-200">Precio (RD$/día)</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600 w-20 border-l border-gray-200">Aceptar</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600 w-20 border-l border-gray-200">Declinar</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600 w-28 border-l border-gray-200">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {INSURANCE_ITEMS.map(it => (
                        <tr key={it.key} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{it.label}</td>
                          <td className="px-3 py-2 border-l border-gray-200">
                            <PriceInput value={prices[it.key] ?? ''} onChange={v => setPrice(it.key, v)} disabled={pending} />
                          </td>
                          <td className="px-3 py-2 border-l border-gray-200 text-center">
                            <input type="radio" name={`ins_${it.key}`} checked={!!checked[it.key]}
                              onChange={() => toggle(it.key, true)} disabled={pending} className="accent-green-600" />
                          </td>
                          <td className="px-3 py-2 border-l border-gray-200 text-center">
                            <input type="radio" name={`ins_${it.key}`} checked={!checked[it.key]}
                              onChange={() => toggle(it.key, false)} disabled={pending} className="accent-red-600" />
                          </td>
                          <td className="px-3 py-2 border-l border-gray-200 text-right text-gray-700 whitespace-nowrap">
                            {checked[it.key] ? money(line(it.key)?.amount ?? 0) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600">Deducible del seguro</span>
                  <span className="text-gray-400">RD$</span>
                  <div className="w-28"><PriceInput value={deductible} onChange={setDeductible} disabled={pending} /></div>
                </div>

                {/* Extras e impuestos */}
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {([['Extras', EXTRA_ITEMS], ['Impuestos', TAX_ITEMS]] as const).map(([title, items]) => (
                    <div key={title} className="p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase">{title}</p>
                      {items.map(it => (
                        <div key={it.key} className="flex items-center gap-2 text-xs">
                          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                            <input type="checkbox" checked={!!checked[it.key]} onChange={e => toggle(it.key, e.target.checked)}
                              disabled={pending} className="rounded accent-blue-600 flex-shrink-0" />
                            <span className="text-gray-700 truncate">{it.label}</span>
                          </label>
                          <div className="w-20"><PriceInput value={prices[it.key] ?? ''} onChange={v => setPrice(it.key, v)} disabled={pending} /></div>
                          <span className="w-8 text-gray-400">{unit(it)}</span>
                          <span className="w-24 text-right text-gray-700 whitespace-nowrap">{checked[it.key] ? money(line(it.key)?.amount ?? 0) : '—'}</span>
                        </div>
                      ))}
                      {title === 'Extras' && (
                        <div className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={otrosChecked} onChange={e => { setOtrosChecked(e.target.checked); touch() }}
                            disabled={pending} className="rounded accent-blue-600 flex-shrink-0" />
                          <input type="text" value={otrosLabel} onChange={e => { setOtrosLabel(e.target.value.slice(0, 80)); touch() }}
                            placeholder="Otros: descripción…" disabled={pending}
                            className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                          <div className="w-20"><PriceInput value={otrosPrice} onChange={v => { setOtrosPrice(v); touch() }} disabled={pending} /></div>
                          <span className="w-8" />
                          <span className="w-24 text-right text-gray-700 whitespace-nowrap">{otrosChecked ? money(line('otros')?.amount ?? 0) : '—'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Resumen: igual que el que sale en el contrato */}
                <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-gray-600">Renta ({breakdown.days}d × {money(breakdown.daily_rate)})</span><span>{money(breakdown.rental_subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Seguros</span><span>{money(breakdown.insurance_total)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Extras</span><span>{money(breakdown.extras_total)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Impuestos</span><span>{money(breakdown.taxes_total)}</span></div>
                  {hasAdjustments && (
                    <div className="flex justify-between text-amber-700">
                      <span>Ajustes (cambio de fecha o de vehículo)</span>
                      <span>{money((savedTotal ?? 0) - breakdown.total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 text-sm">
                    <span className="font-semibold text-gray-800">Total del contrato</span>
                    <span className="font-bold text-blue-700">{money(finalTotal)}</span>
                  </div>
                  {pricingChanged && savedTotal != null && Math.abs(savedTotal - breakdown.total) >= 0.01 && (
                    <p className="text-amber-700 pt-1">
                      El total de la reserva cambiará de {money(savedTotal)} a {money(breakdown.total)} al generar el contrato.
                    </p>
                  )}
                </div>
              </section>

              {/* ── Botones de acción ─────────────────────────────────────────── */}
              <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handlePrintDirect}
                  disabled={pending}
                  className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Imprime con lo último que se guardó, sin guardar los cambios de este formulario"
                >
                  Imprimir sin guardar cambios
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {pending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Guardando...
                    </>
                  ) : 'Guardar y generar contrato'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  )
}
