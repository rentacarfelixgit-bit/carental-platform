'use client'

// src/app/dashboard/reservas/[id]/ContratoButton.tsx
// Botón "Contrato" que abre un modal para completar datos antes de imprimir.

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { saveClientAddress } from '@/app/dashboard/clientes/actions'

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

interface Props {
  reservationId: string
  client: ClientForContrato | null
}

type InsStatus = 'a' | 'd' | ''

const INS_LABELS: Record<string, string> = {
  cdw: 'SEGURO DE COLISIÓN — CDW',
  lia: 'SEG. DAÑOS A TERCEROS — LIABILITY',
  tw:  'SEG. GOMAS Y CRISTALES — TIRES AND WINDSHIELD',
  at:  'SEG. ANTI-ROBOS — ANTI-THEFT',
  pkg: 'PAQUETE CDW / LIA / TW / AT',
}

const INS_KEYS = ['cdw', 'lia', 'tw', 'at', 'pkg'] as const

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:opacity-50"
    />
  )
}

export default function ContratoButton({ reservationId, client }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(saveClientAddress, {})

  // ── Dirección (se guarda en BD) ──────────────────────────────────────────
  const [address,      setAddress]      = useState(client?.address      ?? '')
  const [city,         setCity]         = useState(client?.city         ?? '')
  const [clientState,  setClientState]  = useState(client?.state        ?? '')
  const [zipCode,      setZipCode]      = useState(client?.zip_code     ?? '')
  const [localPhone,   setLocalPhone]   = useState(client?.local_phone  ?? '')
  const [localAddress, setLocalAddress] = useState(client?.local_address ?? '')

  // ── Detalles del contrato (solo URL params) ──────────────────────────────
  const [folio,         setFolio]        = useState('')
  const [aprobacion,    setAprobacion]   = useState('')
  const [preparadoPor,  setPreparadoPor] = useState('')
  const [pago,          setPago]         = useState<'efectivo' | 'tarjeta' | ''>('')

  // ── Conductores adicionales ──────────────────────────────────────────────
  const [d1Lic, setD1Lic] = useState('')
  const [d1Tel, setD1Tel] = useState('')
  const [d2Lic, setD2Lic] = useState('')
  const [d2Tel, setD2Tel] = useState('')
  const [edad,  setEdad]  = useState('')
  const [mascotas, setMascotas] = useState(false)

  // ── Seguros ──────────────────────────────────────────────────────────────
  const [insStatus, setInsStatus] = useState<Record<string, InsStatus>>({
    cdw: '', lia: '', tw: '', at: '', pkg: '', bas: '',
  })
  const [insPrice, setInsPrice] = useState<Record<string, string>>({
    cdw: '', lia: '', tw: '', at: '', pkg: '', bas: '', deduct_bas: '',
  })

  function setStatus(key: string, val: InsStatus) {
    setInsStatus(prev => ({ ...prev, [key]: val }))
  }
  function setPrice(key: string, val: string) {
    setInsPrice(prev => ({ ...prev, [key]: val }))
  }

  // ── Construir URL con todos los params ───────────────────────────────────
  function buildUrl() {
    const p = new URLSearchParams()
    if (folio)                p.set('folio',        folio)
    if (aprobacion)           p.set('aprobacion',   aprobacion)
    if (preparadoPor)         p.set('preparado_por', preparadoPor)
    if (pago)                 p.set('pago',          pago)
    if (d1Lic)                p.set('d1_lic',        d1Lic)
    if (d1Tel)                p.set('d1_tel',        d1Tel)
    if (d2Lic)                p.set('d2_lic',        d2Lic)
    if (d2Tel)                p.set('d2_tel',        d2Tel)
    if (edad)                 p.set('edad',          edad)
    if (mascotas)             p.set('mascotas',      '1')
    for (const k of [...INS_KEYS, 'bas'] as string[]) {
      if (insStatus[k])       p.set(`seg_${k}`,   insStatus[k])
      if (insPrice[k])        p.set(`price_${k}`, insPrice[k])
    }
    if (insPrice['deduct_bas']) p.set('deduct_bas', insPrice['deduct_bas'])
    return `/print/reservas/${reservationId}/contrato?${p.toString()}`
  }

  // ── Después de guardar dirección, abrir contrato ─────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.success) {
      window.open(buildUrl(), '_blank')
      setOpen(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  function handlePrintDirect() {
    window.open(`/print/reservas/${reservationId}/contrato`, '_blank')
    setOpen(false)
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

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
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-gray-900/60 backdrop-blur-sm overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Preparar contrato</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Completa los datos antes de generar el contrato imprimible.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form action={action} className="divide-y divide-gray-100">

              {/* Campos ocultos para la acción de servidor */}
              <input type="hidden" name="client_id"     value={client?.id      ?? ''} />
              <input type="hidden" name="address"       value={address} />
              <input type="hidden" name="city"          value={city} />
              <input type="hidden" name="state"         value={clientState} />
              <input type="hidden" name="zip_code"      value={zipCode} />
              <input type="hidden" name="local_phone"   value={localPhone} />
              <input type="hidden" name="local_address" value={localAddress} />

              {/* Error del servidor */}
              {state.error && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {state.error}
                </div>
              )}

              {/* ── 1. Datos del cliente (solo lectura) ─────────────────────── */}
              <section className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del cliente</h3>
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
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

              {/* ── 2. Dirección (se guarda en BD) ──────────────────────────── */}
              <section className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dirección del cliente</h3>
                <p className="text-xs text-gray-400">Estos datos se guardarán en el perfil del cliente.</p>
                <FieldRow label="Dirección">
                  <TextInput value={address} onChange={setAddress} placeholder="Calle / Av., #123" disabled={pending} maxLength={200} />
                </FieldRow>
                <div className="grid grid-cols-3 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Teléfono de contacto local">
                    <TextInput value={localPhone} onChange={setLocalPhone} placeholder="809-000-0000" disabled={pending} maxLength={30} />
                  </FieldRow>
                  <FieldRow label="Dirección local">
                    <TextInput value={localAddress} onChange={setLocalAddress} placeholder="Hotel / Airbnb..." disabled={pending} maxLength={200} />
                  </FieldRow>
                </div>
              </section>

              {/* ── 3. Detalles del contrato ─────────────────────────────────── */}
              <section className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles del contrato</h3>
                <div className="grid grid-cols-2 gap-3">
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
                  <div className="flex gap-4 mt-1">
                    {(['efectivo', 'tarjeta'] as const).map(v => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="pago_ui"
                          value={v}
                          checked={pago === v}
                          onChange={() => setPago(v)}
                          disabled={pending}
                          className="accent-blue-600"
                        />
                        <span className="text-sm text-gray-700 capitalize">{v}</span>
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

              {/* ── 4. Conductores adicionales ───────────────────────────────── */}
              <section className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conductores adicionales</h3>
                <div className="grid grid-cols-2 gap-3">
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
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <FieldRow label="Edad del conductor">
                      <input
                        type="number"
                        value={edad}
                        onChange={e => setEdad(e.target.value)}
                        min={18}
                        max={99}
                        placeholder="25"
                        disabled={pending}
                        className={inp}
                      />
                    </FieldRow>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none pt-5">
                    <input
                      type="checkbox"
                      checked={mascotas}
                      onChange={e => setMascotas(e.target.checked)}
                      disabled={pending}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">Cliente tiene mascotas</span>
                  </label>
                </div>
              </section>

              {/* ── 5. Seguros ───────────────────────────────────────────────── */}
              <section className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seguros</h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600 w-2/5">Seguro</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 w-1/5 border-l border-gray-200">Precio (USD)</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600 w-1/5 border-l border-gray-200">Aceptar</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600 w-1/5 border-l border-gray-200">Declinar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {INS_KEYS.map(k => (
                        <tr key={k} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{INS_LABELS[k]}</td>
                          <td className="px-3 py-2 border-l border-gray-200">
                            <input
                              type="text"
                              value={insPrice[k]}
                              onChange={e => setPrice(k, e.target.value.replace(/[^0-9.]/g, '').slice(0, 10))}
                              placeholder="0.00"
                              disabled={pending}
                              maxLength={10}
                              inputMode="decimal"
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 border-l border-gray-200 text-center">
                            <input
                              type="radio"
                              name={`ins_${k}`}
                              value="a"
                              checked={insStatus[k] === 'a'}
                              onChange={() => setStatus(k, 'a')}
                              disabled={pending}
                              className="accent-green-600"
                            />
                          </td>
                          <td className="px-3 py-2 border-l border-gray-200 text-center">
                            <input
                              type="radio"
                              name={`ins_${k}`}
                              value="d"
                              checked={insStatus[k] === 'd'}
                              onChange={() => setStatus(k, 'd')}
                              disabled={pending}
                              className="accent-red-600"
                            />
                          </td>
                        </tr>
                      ))}
                      {/* Seguro Básico — tiene deducible en vez de aceptar/declinar */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">SEGURO BÁSICO — LIA / TW</td>
                        <td className="px-3 py-2 border-l border-gray-200">
                          <input
                            type="text"
                            value={insPrice['bas']}
                            onChange={e => setPrice('bas', e.target.value.replace(/[^0-9.]/g, '').slice(0, 10))}
                            placeholder="0.00"
                            disabled={pending}
                            maxLength={10}
                            inputMode="decimal"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                          />
                        </td>
                        <td colSpan={2} className="px-3 py-2 border-l border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">Deducible:</span>
                            <input
                              type="text"
                              value={insPrice['deduct_bas']}
                              onChange={e => setPrice('deduct_bas', e.target.value.replace(/[^0-9.]/g, '').slice(0, 10))}
                              placeholder="0.00"
                              disabled={pending}
                              maxLength={10}
                              inputMode="decimal"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                            />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── Botones de acción ─────────────────────────────────────────── */}
              <div className="px-6 py-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handlePrintDirect}
                  disabled={pending}
                  className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Imprimir sin completar
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
                  ) : 'Generar contrato'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  )
}
