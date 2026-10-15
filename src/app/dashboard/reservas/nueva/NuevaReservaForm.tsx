'use client'

// src/app/dashboard/reservas/nueva/NuevaReservaForm.tsx

import { useState, useTransition, useActionState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createReservation, getAvailableVehicles, searchClients } from '../actions'
import BlacklistWarning from '@/components/dashboard/BlacklistWarning'
import Link from 'next/link'
import { calendarHref, type CalendarReturn } from '@/lib/calendarReturn'
import {
  INSURANCE_ITEMS, EXTRA_ITEMS, TAX_ITEMS, ALL_PRICE_ITEMS,
  type PriceItem, type ReservationPrices, computeBreakdown } from '@/lib/reservationPrices'

interface Client {
  id: string; full_name: string; id_number: string
  phone: string | null; email: string | null
  license_number: string | null; license_expiry: string | null
  passport_number: string | null; passport_expiry: string | null
  address: string | null; city: string | null; state: string | null; zip_code: string | null
}
interface Vehicle {
  id: string; plates: string; brand: string; model: string; year: number; color: string; daily_rate?: number | null
}

interface Props {
  clients: Client[]
  initialStartDate?: string
  initialEndDate?: string
  initialVehicleId?: string
  /** Precios por defecto definidos por el admin en Configuración */
  defaultPrices: ReservationPrices
  /**
   * 'reservation' (default): reserva normal, nace en "pendiente".
   * 'contract': contrato de mostrador (walk-in), nace como "contrato abierto" (confirmed).
   * El formulario y el flujo son los mismos; solo cambian textos y el origen guardado.
   */
  mode?: 'reservation' | 'contract'
  /** Si se abrió desde el calendario: a dónde regresar al cancelar o al guardar */
  calendarReturn?: CalendarReturn | null
}

// ── Seguros, extras e impuestos que van en el sidebar (catálogo en @/lib/reservationPrices) ──
const INSURANCES   = INSURANCE_ITEMS
const EXTRAS_FIXED = EXTRA_ITEMS
const TAXES_FIXED  = TAX_ITEMS

/** Input de precio editable que aparece al marcar un concepto */
function PriceField({ item, value, onChange }: {
  item: PriceItem; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="ml-5 mb-1 flex items-center gap-1">
      {item.kind !== 'pct' && <span className="text-[10px] text-gray-400">RD$</span>}
      <input
        type="text" inputMode="decimal" placeholder="0.00" value={value}
        onChange={e => {
          const v = e.target.value
          if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) onChange(v)
        }}
        className="w-20 px-2 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="text-[10px] text-gray-400">
        {item.kind === 'per_day' ? '/día' : item.kind === 'pct' ? '%' : 'por reserva'}
      </span>
    </div>
  )
}

const LADAS = [
  { code: '+1',  flag: '🇩🇴' }, { code: '+1',  flag: '🇺🇸' },
  { code: '+52', flag: '🇲🇽' }, { code: '+58', flag: '🇻🇪' },
  { code: '+57', flag: '🇨🇴' }, { code: '+34', flag: '🇪🇸' },
]

// ── Sanitizado de inputs (se aplica mientras el usuario escribe) ─────────────
const clean = {
  /** Solo dígitos (celular, zip) */
  digits:   (v: string, max: number) => v.replace(/\D/g, '').slice(0, max),
  /** Letras (con acentos/ñ), espacios, apóstrofe, punto y guion — nombres, ciudad, estado */
  name:     (v: string, max: number) => v.replace(/[^\p{L}\s'.-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, max),
  /** Letras, números y guion, en mayúsculas — licencia y pasaporte */
  doc:      (v: string, max: number) => v.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, max),
  /** Sin espacios — email */
  email:    (v: string, max: number) => v.replace(/\s/g, '').slice(0, max),
}

/** Evita que en inputs type="number" se escriban e, E, +, - (el navegador los permite por notación científica). */
function blockNonNumericKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}

const PHONE_MIN = 7
const PHONE_MAX = 15

export default function NuevaReservaForm({
  clients: initialClients,
  initialStartDate = '',
  initialEndDate   = '',
  initialVehicleId = '',
  defaultPrices,
  mode = 'reservation',
  calendarReturn = null,
}: Props) {
  const isContract = mode === 'contract'
  const sectionHref  = calendarReturn ? calendarHref(calendarReturn) : isContract ? '/dashboard/contratos' : '/dashboard/reservas'
  const sectionLabel = calendarReturn ? 'Calendario' : isContract ? 'Contratos' : 'Reservas'
  const [state, action, pending] = useActionState(createReservation, {})

  // ── Clientes ──────────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch]       = useState('')
  const [showDropdown, setShowDropdown]       = useState(false)
  const [selectedClient, setSelectedClient]   = useState<Client | null>(null)
  const [searchResults, setSearchResults]     = useState<Client[]>(initialClients.slice(0, 8))
  const [searching, setSearching]             = useTransition()
  const [blacklistStatus, setBlacklistStatus] = useState<{ blacklisted: boolean; reason?: string; addedAt?: string } | null>(null)
  const [checkingBlacklist, setCheckingBlacklist] = useTransition()
  const searchRef   = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Campos del cliente (pre-llenados y editables; los cambios se guardan en el cliente al crear la reserva)
  const [cName,     setCName]     = useState('')
  const [cPhCode,   setCPhCode]   = useState('+1')
  const [cPhone,    setCPhone]    = useState('')
  const [cEmail,    setCEmail]    = useState('')
  const [cLic,      setCLic]      = useState('')
  const [cLicExp,   setCLicExp]   = useState('')
  const [cPass,     setCPass]     = useState('')
  const [cPassExp,  setCPassExp]  = useState('')
  const [cAddr,     setCAddr]     = useState('')
  const [cCity,     setCCity]     = useState('')
  const [cState,    setCState]    = useState('')
  const [cZip,      setCZip]      = useState('')

  function fillClientFields(c: Client | null) {
    if (!c) {
      setCName(''); setCPhone(''); setCEmail('')
      setCLic(''); setCLicExp(''); setCPass(''); setCPassExp('')
      setCAddr(''); setCCity(''); setCState(''); setCZip('')
      return
    }
    // Parse lada from phone
    let code = '+1', num = c.phone ?? ''
    for (const l of LADAS) {
      if (num.startsWith(l.code)) { code = l.code; num = num.slice(l.code.length).trim(); break }
    }
    setCName(c.full_name)
    setCPhCode(code); setCPhone(clean.digits(num, PHONE_MAX))
    setCEmail(c.email ?? '')
    setCLic(c.license_number ?? '')
    setCLicExp(c.license_expiry?.split('T')[0] ?? '')
    setCPass(c.passport_number ?? '')
    setCPassExp(c.passport_expiry?.split('T')[0] ?? '')
    setCAddr(c.address ?? '')
    setCCity(c.city ?? '')
    setCState(c.state ?? '')
    setCZip(c.zip_code ?? '')
  }

  // Búsqueda con debounce contra el servidor
  const runSearch = useCallback((q: string) => {
    setSearching(async () => {
      const results = await searchClients(q)
      setSearchResults(results as Client[])
    })
  }, [setSearching])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(clientSearch), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [clientSearch, runSearch])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current  && !searchRef.current.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectClient(c: Client) {
    setSelectedClient(c)
    setClientSearch(c.full_name)
    setShowDropdown(false)
    fillClientFields(c)
    setBlacklistStatus(null)
    setCheckingBlacklist(async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('client_blacklist').select('id, reason, added_at')
        .eq('client_id', c.id).eq('active', true).maybeSingle()
      setBlacklistStatus(data
        ? { blacklisted: true, reason: data.reason, addedAt: data.added_at }
        : { blacklisted: false }
      )
    })
  }

  function clearClient() {
    setSelectedClient(null); setClientSearch('')
    setBlacklistStatus(null); fillClientFields(null)
    searchRef.current?.focus()
  }

  // ── Vehículos y fechas ────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate,   setEndDate]   = useState(initialEndDate)
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[] | null>(null)
  const [loadingVehicles, setLoadingVehicles]     = useTransition()
  const [selectedVehicle, setSelectedVehicle]     = useState<Vehicle | null>(null)
  const [dailyRate, setDailyRate] = useState('')
  // Controlado para que no se borre si el servidor regresa un error (React resetea los campos no controlados)
  const [observaciones, setObservaciones] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  useEffect(() => {
    if (initialStartDate && initialEndDate && new Date(initialEndDate) > new Date(initialStartDate)) {
      setLoadingVehicles(async () => {
        const list = (await getAvailableVehicles(initialStartDate, initialEndDate)) as Vehicle[]
        setAvailableVehicles(list)
        if (initialVehicleId) {
          const v = list.find(v => v.id === initialVehicleId)
          if (v) { setSelectedVehicle(v); setDailyRate(String(v.daily_rate ?? '')) }
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDateChange(newStart: string, newEnd: string) {
    if (newStart) setStartDate(newStart)
    if (newEnd)   setEndDate(newEnd)
    const s = newStart || startDate
    const e = newEnd   || endDate
    if (!s || !e || new Date(e) <= new Date(s)) { setAvailableVehicles(null); return }
    setLoadingVehicles(async () => {
      const list = (await getAvailableVehicles(s, e)) as Vehicle[]
      setAvailableVehicles(list)
      setSelectedVehicle(null); setDailyRate('')
    })
  }

  const rentalDays = useMemo(() => {
    if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) return 0
    return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
  }, [startDate, endDate])

  // ── Seguros ───────────────────────────────────────────────────────────────
  const [insChecked, setInsChecked] = useState<Record<string, boolean>>({})
  // Precios de seguros, extras e impuestos: precargados desde Configuración, editables por reserva
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(ALL_PRICE_ITEMS.map(i => [i.key, defaultPrices[i.key] ? String(defaultPrices[i.key]) : '']))
  )
  const priceOf = (key: string) => parseFloat(prices[key] || '0') || 0

  // ── Extras & taxes ────────────────────────────────────────────────────────
  const [extrasChecked, setExtrasChecked] = useState<Record<string, boolean>>({})
  const [taxesChecked,  setTaxesChecked]  = useState<Record<string, boolean>>({})
  const [otrosLabel,    setOtrosLabel]    = useState('')
  const [otrosChecked,  setOtrosChecked]  = useState(false)
  const [otrosPrice,    setOtrosPrice]    = useState('')

  // ── Pago ──────────────────────────────────────────────────────────────────
  const [payEfectivo, setPayEfectivo] = useState(false)
  const [abonoEfectivo, setAbonoEfectivo] = useState('')
  const [payTarjeta, setPayTarjeta]  = useState(false)
  const [abonoTarjeta, setAbonoTarjeta] = useState('')

  // Valores del enum payment_method en Postgres: cash | card | mixed
  const paymentMethod = payEfectivo && payTarjeta ? 'mixed'
    : payEfectivo ? 'cash'
    : payTarjeta  ? 'card'
    : ''

  // ── Cálculo resumen ───────────────────────────────────────────────────────
  // Mismo cálculo que "Preparar contrato" y el servidor (@/lib/reservationPrices → computeBreakdown).
  // El desglose se guarda en la reserva para que el contrato muestre exactamente lo mismo.
  const rate = parseFloat(dailyRate) || 0
  const breakdown = computeBreakdown({
    days: rentalDays,
    dailyRate: rate,
    checked: { ...insChecked, ...extrasChecked, ...taxesChecked },
    prices: Object.fromEntries(ALL_PRICE_ITEMS.map(i => [i.key, priceOf(i.key)])),
    otros: { label: otrosLabel, price: parseFloat(otrosPrice || '0') || 0, checked: otrosChecked },
  })
  const rentalSubtotal = breakdown.rental_subtotal
  const otrosTotal = breakdown.lines.find(l => l.key === 'otros')?.amount ?? 0
  const taxAmount = (t: PriceItem) => breakdown.lines.find(l => l.key === t.key)?.amount ?? 0
  const grandTotal = breakdown.total

  // ¿El usuario modificó datos del cliente seleccionado? (se guardarán al crear la reserva)
  const clientDirty = useMemo(() => {
    if (!selectedClient) return false
    const c = selectedClient
    const norm = (v: string | null | undefined) => (v ?? '').trim()
    const phoneNow  = cPhone.trim() ? `${cPhCode}${cPhone.trim()}` : ''
    return (
      norm(c.full_name) !== cName.trim() ||
      norm(c.phone).replace(/\s+/g, '') !== phoneNow.replace(/\s+/g, '') ||
      norm(c.email) !== cEmail.trim() ||
      norm(c.license_number).toUpperCase() !== cLic.trim().toUpperCase() ||
      norm(c.license_expiry?.split('T')[0]) !== cLicExp ||
      norm(c.passport_number).toUpperCase() !== cPass.trim().toUpperCase() ||
      norm(c.passport_expiry?.split('T')[0]) !== cPassExp ||
      norm(c.address) !== cAddr.trim() ||
      norm(c.city) !== cCity.trim() ||
      norm(c.state) !== cState.trim() ||
      norm(c.zip_code) !== cZip.trim()
    )
  }, [selectedClient, cName, cPhCode, cPhone, cEmail, cLic, cLicExp, cPass, cPassExp, cAddr, cCity, cState, cZip])

  const isBlacklisted = blacklistStatus?.blacklisted === true

  function insField(key: string) {
    return {
      accepted: insChecked[key] ? 'true' : 'false',
      price:    insChecked[key] ? (prices[key] || '') : '',
    }
  }

  // ── Clases helper ─────────────────────────────────────────────────────────
  const inputCls = 'w-full min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 placeholder:text-gray-400'
  const roInputCls = 'w-full min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-800'

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-4">
        <Link href={sectionHref} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {sectionLabel}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{isContract ? 'Nuevo contrato' : 'Nueva reserva'}</h1>
        {isContract && (
          <p className="text-sm text-gray-500 mt-0.5">
            Cliente en mostrador, sin reserva previa. El contrato se abre listo para tomar las fotos de salida y entregar el vehículo.
          </p>
        )}
      </div>

      <form action={action}>
        {/* Inputs ocultos */}
        <input type="hidden" name="client_id"    value={selectedClient?.id ?? ''} />
        <input type="hidden" name="origin"       value={isContract ? 'walk_in' : 'reservation'} />
        {calendarReturn && (
          <>
            <input type="hidden" name="cal_from"  value="calendario" />
            <input type="hidden" name="cal_mes"   value={calendarReturn.mes} />
            <input type="hidden" name="cal_dia"   value={calendarReturn.dia ?? ''} />
            <input type="hidden" name="cal_vista" value={calendarReturn.vista} />
          </>
        )}
        <input type="hidden" name="total_amount" value={grandTotal > 0 ? grandTotal.toFixed(2) : ''} />
        <input type="hidden" name="payment_method" value={paymentMethod} />
        <input type="hidden" name="daily_rate"     value={dailyRate} />
        <input type="hidden" name="price_breakdown" value={rentalDays > 0 ? JSON.stringify(breakdown) : ''} />
        {/* Abonos: solo se mandan si su método de pago está activado */}
        <input type="hidden" name="cash_payment" value={payEfectivo ? abonoEfectivo : ''} />
        <input type="hidden" name="card_payment" value={payTarjeta ? abonoTarjeta : ''} />
        <input type="hidden" name="insurance_cdw_accepted" value={insField('cdw').accepted} />
        <input type="hidden" name="insurance_cdw_price"    value={insField('cdw').price} />
        <input type="hidden" name="insurance_lia_accepted" value={insField('lia').accepted} />
        <input type="hidden" name="insurance_lia_price"    value={insField('lia').price} />
        <input type="hidden" name="insurance_tw_accepted"  value={insField('tw').accepted} />
        <input type="hidden" name="insurance_tw_price"     value={insField('tw').price} />
        <input type="hidden" name="insurance_at_accepted"  value={insField('at').accepted} />
        <input type="hidden" name="insurance_at_price"     value={insField('at').price} />

        {/* Errores y blacklist */}
        {state.error && !state.blacklisted && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{state.error}</div>
        )}
        {(isBlacklisted || state.blacklisted) && (
          <div className="mb-4">
            <BlacklistWarning
              reason={(blacklistStatus?.reason ?? state.blacklistReason) || 'Cliente en lista negra'}
              addedAt={blacklistStatus?.addedAt}
              blocking
            />
          </div>
        )}

        {/* ══ LAYOUT PRINCIPAL ═══════════════════════════════════════════════
            Móvil/tablet: formulario → precios y resumen → botones (barra fija abajo).
            Escritorio (xl): formulario + botones a la izquierda, panel fijo a la derecha. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem] gap-4 xl:gap-5 items-start">

          {/* ═══ COLUMNA PRINCIPAL ══════════════════════════════════════════ */}
          <div className="@container min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">

            {/* ── Datos del Cliente ──────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800">Datos del Cliente</h2>
              </div>

              {/* Autocomplete buscar cliente */}
              <div className="relative mb-4">
                <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${selectedClient ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value)
                      setShowDropdown(true)
                      if (selectedClient && e.target.value !== selectedClient.full_name) {
                        setSelectedClient(null); fillClientFields(null); setBlacklistStatus(null)
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Buscar cliente existente por nombre, licencia o ID... (si es nuevo, llena los datos abajo)"
                    disabled={pending}
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
                  />
                  {selectedClient && (
                    <button type="button" onClick={clearClient} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {checkingBlacklist && (
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full" />
                  )}
                </div>
                {showDropdown && !selectedClient && (
                  <div ref={dropdownRef} className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {searching ? (
                      <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                        <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full" />
                        Buscando...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">No se encontraron clientes.</p>
                    ) : (
                      <ul className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                        {searchResults.map(c => (
                          <li key={c.id}>
                            <button type="button" onClick={() => selectClient(c)}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors">
                              <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                              <p className="text-xs text-gray-500">{c.id_number}{c.license_number ? ` · Lic: ${c.license_number}` : ''}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {state.fieldErrors?.client_id && (
                  <p className="mt-1 text-xs text-red-600">{state.fieldErrors.client_id[0]}</p>
                )}
              </div>

              {/* Grid 2 columnas: campos del cliente */}
              <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-6 gap-y-3">

                {/* Izquierda */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                    <input type="text" name="client_full_name" value={cName} onChange={e => setCName(clean.name(e.target.value, 150))}
                      maxLength={150} autoComplete="name"
                      placeholder="—" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono / Celular <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <select name="client_phone_code" value={cPhCode} onChange={e => setCPhCode(e.target.value)}
                        className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ minWidth: 80 }}>
                        {LADAS.map((l, i) => <option key={i} value={l.code}>{l.flag} {l.code}</option>)}
                      </select>
                      <input type="tel" name="client_phone" value={cPhone}
                        onChange={e => setCPhone(clean.digits(e.target.value, PHONE_MAX))}
                        inputMode="numeric" pattern="[0-9]*" maxLength={PHONE_MAX} autoComplete="tel-national"
                        placeholder="Solo números" className={`flex-1 ${inputCls}`} />
                    </div>
                    {cPhone.length > 0 && cPhone.length < PHONE_MIN && (
                      <p className="mt-1 text-xs text-red-600">El número debe tener al menos {PHONE_MIN} dígitos.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email (Opcional)</label>
                    <input type="email" name="client_email" value={cEmail} onChange={e => setCEmail(clean.email(e.target.value, 150))}
                      maxLength={150} autoComplete="email"
                      placeholder="—" className={inputCls} />
                  </div>
                </div>

                {/* Derecha */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Licencia de Conducir <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 @xl:grid-cols-1 @3xl:grid-cols-2 gap-2 items-end">
                      <input type="text" name="client_license_number" value={cLic} onChange={e => setCLic(clean.doc(e.target.value, 30))} maxLength={30}
                        placeholder="—" className={`${inputCls} uppercase`} />
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fecha de Vencimiento <span className="text-red-500">*</span></label>
                        <input type="date" name="client_license_expiry" value={cLicExp} onChange={e => setCLicExp(e.target.value)}
                          className={inputCls} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pasaporte o Identificación</label>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 @xl:grid-cols-1 @3xl:grid-cols-2 gap-2 items-end">
                      <input type="text" name="client_passport_number" value={cPass} onChange={e => setCPass(clean.doc(e.target.value, 30))} maxLength={30}
                        placeholder="—" className={`${inputCls} uppercase`} />
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fecha de Vencimiento</label>
                        <input type="date" name="client_passport_expiry" value={cPassExp} onChange={e => setCPassExp(e.target.value)}
                          className={inputCls} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Dirección: fila completa debajo de las dos columnas */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                <div className="grid grid-cols-2 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-2">
                  <input type="text" name="client_address" value={cAddr} onChange={e => setCAddr(e.target.value.slice(0, 200))} maxLength={200}
                    placeholder="Calle, número, sector" className={`col-span-2 @2xl:col-span-1 ${inputCls}`} />
                  <input type="text" name="client_city" value={cCity} onChange={e => setCCity(clean.name(e.target.value, 100))} maxLength={100}
                    placeholder="Ciudad" className={inputCls} />
                  <input type="text" name="client_state" value={cState} onChange={e => setCState(clean.name(e.target.value, 100))} maxLength={100}
                    placeholder="Estado / Provincia" className={inputCls} />
                  <input type="text" name="client_zip_code" value={cZip} onChange={e => setCZip(clean.digits(e.target.value, 10))}
                    inputMode="numeric" pattern="[0-9]*" maxLength={10}
                    placeholder="Zip" className={`col-span-2 @2xl:col-span-1 ${inputCls}`} />
                </div>
              </div>
              {!selectedClient && cName.trim() && (
                <p className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Cliente nuevo: se dará de alta con estos datos al {isContract ? 'abrir el contrato' : 'crear la reserva'}.
                </p>
              )}
              {clientDirty && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Modificaste datos del cliente. Los cambios se guardarán en su ficha al {isContract ? 'abrir el contrato' : 'crear la reserva'}.
                </p>
              )}
            </div>

            {/* ── Datos del Vehículo + Datos de la Renta ─────────────────── */}
            <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4">

              {/* Vehículo */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-800">Datos del Vehículo</h2>
                {!startDate || !endDate ? (
                  <p className="text-xs text-gray-400">Completa las fechas para ver vehículos disponibles.</p>
                ) : loadingVehicles ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    Buscando...
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Ficha del Vehículo <span className="text-red-500">*</span>
                        {availableVehicles && (
                          <span className="text-gray-400 font-normal ml-1">({availableVehicles.length} disponible{availableVehicles.length !== 1 ? 's' : ''})</span>
                        )}
                      </label>
                      {availableVehicles?.length === 0 ? (
                        <p className="text-sm text-orange-600 py-2">No hay vehículos disponibles para esas fechas.</p>
                      ) : (
                        <select
                          name="vehicle_id"
                          value={selectedVehicle?.id ?? ''}
                          disabled={pending}
                          onChange={e => {
                            const v = availableVehicles?.find(v => v.id === e.target.value) ?? null
                            setSelectedVehicle(v)
                            setDailyRate(v?.daily_rate ? String(v.daily_rate) : '')
                          }}
                          className={inputCls}
                        >
                          <option value="">— Selecciona —</option>
                          {(availableVehicles ?? []).map(v => (
                            <option key={v.id} value={v.id}>
                              {v.brand} {v.model} {v.year} · {v.color}
                            </option>
                          ))}
                        </select>
                      )}
                      {state.fieldErrors?.vehicle_id && (
                        <p className="mt-1 text-xs text-red-600">{state.fieldErrors.vehicle_id[0]}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Placa</label>
                      <div className={roInputCls}>{selectedVehicle?.plates || '—'}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Renta */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-800">Datos de la Renta</h2>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de Salida <span className="text-red-500">*</span></label>
                  <input type="datetime-local" name="start_date" value={startDate}
                    onChange={e => handleDateChange(e.target.value, '')} disabled={pending} className={inputCls} />
                  {state.fieldErrors?.start_date && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.start_date[0]}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de Retorno <span className="text-red-500">*</span></label>
                  <input type="datetime-local" name="end_date" value={endDate}
                    onChange={e => handleDateChange('', e.target.value)} disabled={pending} className={inputCls} />
                  {state.fieldErrors?.end_date && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.end_date[0]}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa por Día</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">RD$</span>
                      <input type="number" min="0" step="0.01" inputMode="decimal" onKeyDown={blockNonNumericKeys} value={dailyRate}
                        onChange={e => setDailyRate(e.target.value)} disabled={pending}
                        placeholder="0.00" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad de Días</label>
                    <div className={`${roInputCls} font-medium text-blue-700`}>
                      {rentalDays > 0 ? rentalDays : '—'}
                    </div>
                  </div>
                </div>
                {rentalSubtotal > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Subtotal Renta</label>
                      <div className={roInputCls}>RD${rentalSubtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Total General</label>
                      <div className={`${roInputCls} font-bold text-blue-700`}>
                        RD${grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Observaciones | Notas Internas | Método de Pago ────────── */}
            <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-semibold text-gray-800 mb-2">Observaciones</label>
                <textarea name="notes" rows={4} disabled={pending}
                  value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder="Observaciones del contrato..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50" />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-semibold text-gray-800 mb-2">Notas Internas</label>
                <textarea name="internal_notes" rows={4} disabled={pending}
                  value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Instrucciones internas (uso interno)..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400 disabled:opacity-50" />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 @xl:col-span-2 @4xl:col-span-1">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Método de Pago</h2>
                <div className="space-y-3">
                  <Toggle label="Pagos en Efectivo"        checked={payEfectivo} onChange={setPayEfectivo} />
                  {payEfectivo && (
                    <input type="number" min="0" step="0.01" inputMode="decimal" onKeyDown={blockNonNumericKeys} value={abonoEfectivo}
                      onChange={e => setAbonoEfectivo(e.target.value)} placeholder="Abono en Efectivo"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400" />
                  )}
                  <Toggle label="Pagos en Tarjeta de Crédito" checked={payTarjeta} onChange={setPayTarjeta} />
                  {payTarjeta && (
                    <input type="number" min="0" step="0.01" inputMode="decimal" onKeyDown={blockNonNumericKeys} value={abonoTarjeta}
                      onChange={e => setAbonoTarjeta(e.target.value)} placeholder="Abono en Tarjeta"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400" />
                  )}
                </div>
              </div>
            </div>

          </div>{/* fin columna principal */}

          {/* ── Botones ───────────────────────────────────────────────────── */}
          <div className="sticky bottom-0 z-20 -mx-4 md:-mx-6 xl:mx-0 px-4 md:px-6 xl:px-0 py-3 xl:py-0 xl:pb-4 bg-white/95 xl:bg-transparent backdrop-blur border-t border-gray-200 xl:border-0 xl:static xl:col-start-1 xl:row-start-2">
            {grandTotal > 0 && (
              <div className="xl:hidden flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Total</span>
                <span className="font-bold text-blue-700">RD${grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex gap-3">
              <Link href={sectionHref}
                className="flex-1 text-center py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={pending || isBlacklisted || (!selectedClient && !cName.trim()) || (cPhone.length > 0 && cPhone.length < PHONE_MIN) || !availableVehicles || availableVehicles.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Guardando...
                  </>
                ) : isContract ? 'Abrir contrato' : 'Crear reserva'}
              </button>
            </div>
          </div>{/* fin botones */}

          {/* ═══ SIDEBAR ════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 items-start xl:sticky xl:top-4 xl:col-start-2 xl:row-start-1 xl:row-span-2">

            {/* Seguros, Impuestos y Extras */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Seguros, Impuestos y Extras</h2>

              {/* Seguros */}
              <div className="space-y-1.5 mb-3">
                {INSURANCES.map(ins => (
                  <div key={ins.key}>
                    <label className="flex items-center gap-2 cursor-pointer group py-1">
                      <input type="checkbox" checked={!!insChecked[ins.key]}
                        onChange={() => setInsChecked(p => ({ ...p, [ins.key]: !p[ins.key] }))}
                        className="rounded accent-blue-600 flex-shrink-0" />
                      <span className="text-xs text-gray-700 group-hover:text-gray-900 flex-1">{ins.label}</span>
                    </label>
                    {insChecked[ins.key] && (
                      <PriceField item={ins} value={prices[ins.key] ?? ''}
                        onChange={v => setPrices(p => ({ ...p, [ins.key]: v }))} />
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-2.5 space-y-1.5 mb-3">
                {EXTRAS_FIXED.map(e => (
                  <div key={e.key}>
                    <label className="flex items-center gap-2 cursor-pointer group py-1">
                      <input type="checkbox" checked={!!extrasChecked[e.key]}
                        onChange={() => setExtrasChecked(p => ({ ...p, [e.key]: !p[e.key] }))}
                        className="rounded accent-blue-600 flex-shrink-0" />
                      <span className="text-xs text-gray-700 group-hover:text-gray-900 flex-1">{e.label}</span>
                    </label>
                    {extrasChecked[e.key] && (
                      <PriceField item={e} value={prices[e.key] ?? ''}
                        onChange={v => setPrices(p => ({ ...p, [e.key]: v }))} />
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-2.5 space-y-1.5 mb-3">
                {TAXES_FIXED.map(t => (
                  <div key={t.key}>
                    <label className="flex items-center gap-2 cursor-pointer group py-1">
                      <input type="checkbox" checked={!!taxesChecked[t.key]}
                        onChange={() => setTaxesChecked(p => ({ ...p, [t.key]: !p[t.key] }))}
                        className="rounded accent-blue-600 flex-shrink-0" />
                      <span className="text-xs text-gray-700 group-hover:text-gray-900 flex-1">{t.label}</span>
                    </label>
                    {taxesChecked[t.key] && (
                      <PriceField item={t} value={prices[t.key] ?? ''}
                        onChange={v => setPrices(p => ({ ...p, [t.key]: v }))} />
                    )}
                  </div>
                ))}
              </div>

              {/* Otros */}
              <div className="border-t border-gray-100 pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium w-10">Otros:</span>
                  <input type="text" value={otrosLabel} onChange={e => setOtrosLabel(e.target.value)}
                    placeholder="Descripción..."
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                  <input type="checkbox" checked={otrosChecked}
                    onChange={e => setOtrosChecked(e.target.checked)}
                    className="rounded accent-blue-600" />
                </div>
                {otrosChecked && (
                  <div className="mt-1.5">
                    <PriceField item={{ key: 'otros', label: 'Otros', kind: 'flat', fallback: 0 }}
                      value={otrosPrice} onChange={setOtrosPrice} />
                  </div>
                )}
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Resumen</h2>
              {grandTotal === 0 ? (
                <p className="text-xs text-gray-400">Selecciona vehículo y fechas.</p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {rentalSubtotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Renta ({rentalDays}d × RD${rate})</span>
                      <span className="font-medium">RD${rentalSubtotal.toLocaleString('es-DO', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {INSURANCES.filter(i => insChecked[i.key] && priceOf(i.key) > 0).map(ins => (
                    <div key={ins.key} className="flex justify-between">
                      <span className="text-gray-600 truncate mr-2">{ins.label.split('/')[0].trim()}</span>
                      <span className="font-medium whitespace-nowrap">RD${(priceOf(ins.key) * rentalDays).toLocaleString('es-DO', {minimumFractionDigits:2})}</span>
                    </div>
                  ))}
                  {EXTRAS_FIXED.filter(e => extrasChecked[e.key] && priceOf(e.key) > 0).map(e => (
                    <div key={e.key} className="flex justify-between">
                      <span className="text-gray-600 truncate mr-2">{e.label.split('/')[0].trim()}</span>
                      <span className="font-medium whitespace-nowrap">RD${priceOf(e.key).toLocaleString('es-DO', {minimumFractionDigits:2})}</span>
                    </div>
                  ))}
                  {otrosTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 truncate mr-2">{otrosLabel.trim() || 'Otros'}</span>
                      <span className="font-medium whitespace-nowrap">RD${otrosTotal.toLocaleString('es-DO', {minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {TAXES_FIXED.filter(t => taxesChecked[t.key]).map(t => (
                    <div key={t.key} className="flex justify-between">
                      <span className="text-gray-600 truncate mr-2">
                        {t.label.split('/')[0].trim()}{t.kind === 'pct' ? ` (${priceOf(t.key)}%)` : ''}
                      </span>
                      <span className="font-medium whitespace-nowrap">RD${taxAmount(t).toLocaleString('es-DO', {minimumFractionDigits:2})}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-1.5 mt-1.5 flex justify-between">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="font-bold text-blue-700 text-sm">RD${grandTotal.toLocaleString('es-DO', {minimumFractionDigits:2})}</span>
                  </div>
                </div>
              )}
            </div>

          </div>{/* fin sidebar */}
        </div>{/* fin flex */}
      </form>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-red-500' : 'bg-gray-200'}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
