// src/app/print/reservas/[id]/contrato/page.tsx
// Contrato imprimible — layout fiel al contrato físico de Felix Castillo Car Rental

import { createClient } from '@/lib/supabase/server'
import { rentalFolio } from '@/lib/rentalLabels'
import { BREAKDOWN_SELECT, resolveBreakdown, CARD_INSURANCES } from '@/lib/reservationPrices'
import { getContractTerms } from '@/lib/contractTerms'
import { WaiverLetter, CardDeclineLetter, TermsPage } from './ExtraPages'
import { CONTRACT_I18N, parseContractLang, type ContractTexts } from './i18n'
import { fmtUSD, fmtLocal, fmtRate, fmtPayment, toLocal, paymentToUSD, rentalRate, getCurrencySettings } from '@/lib/currency'
import { EQUIPMENT_CONDITION, EQUIPMENT_TYPES, type EquipmentCondition, type EquipmentType } from '@/lib/equipment'
import { SWAP_REASONS, type SwapReason } from '@/lib/vehicleSwap'
import { redirect } from 'next/navigation'
import PrintTrigger from './PrintTrigger'
import PrintButton from './PrintButton'
import { isOpenEnded, effectiveEnd } from '@/lib/openEnded'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Campo de formulario ───────────────────────────────────────────────────
function Field({ label, value, style }: { label: string; value?: string | number | null; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', color: '#000', marginBottom: 1 }}>{label}:</span>
      <div style={{ borderBottom: '0.7px solid #000', minHeight: 14, paddingBottom: 1, fontSize: 9.5, color: '#000' }}>
        {value ?? ''}
      </div>
    </div>
  )
}

// ─── Fila de seguro ────────────────────────────────────────────────────────
function InsuranceRow({ label, price, status, L }: { label: string; price?: string; status?: 'a' | 'd' | ''; L: ContractTexts }) {
  const check = '✓'
  return (
    <tr>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '45%' }}>{label}</td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%' }}>
        {L.price} {price ?? ''}
      </td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%', fontWeight: status === 'a' ? 700 : 400 }}>
        {L.accept} {status === 'a' ? check : ''}
      </td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '19%', fontWeight: status === 'd' ? 700 : 400 }}>
        {L.decline} {status === 'd' ? check : ''}
      </td>
    </tr>
  )
}

export default async function ContratoPrintPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  // Helper para leer un param de string y truncarlo por seguridad de layout
  const p = (key: string, max = 200) => {
    const v = sp[key]
    const s = typeof v === 'string' ? v : ''
    return s.slice(0, max)
  }
  // Idioma de la primera hoja (elegido en "Preparar contrato")
  const lang = parseContractLang(sp.lang)
  const L = CONTRACT_I18N[lang]
  // Datos del modal que llegan por URL
  const spFolio        = p('folio',        50)
  const spAprobacion   = p('aprobacion',   50)
  const spPreparadoPor = p('preparado_por',100)
  const spPago         = p('pago',         10) // 'efectivo' | 'tarjeta'
  const spD1Lic        = p('d1_lic',       30)
  const spD1Tel        = p('d1_tel',       30)
  const spD2Lic        = p('d2_lic',       30)
  const spD2Tel        = p('d2_tel',       30)
  const spEdad         = p('edad',          3)
  const spMascotas     = p('mascotas',      1) === '1'
  const spAddress      = p('address',     200)
  const spCity         = p('city',         80)
  const spState        = p('state',        80)
  const spZip          = p('zip_code',     20)
  const spLocalPhone   = p('local_phone',  30)
  const spLocalAddress = p('local_address',200)
  // Respaldo para enlaces antiguos con parámetros (hoy todo se lee de la reserva)
  const deductBas = p('deduct_bas', 12)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) redirect('/login')

  // Tenant info (nombre de empresa)
  const { data: tenant } = await supabase
    .from('tenants').select('name, settings').eq('id', profile.tenant_id).single()

  // Reserva
  const contractQuery = (cols: string) => supabase.from('reservations').select(cols)
    .eq('id', id).eq('tenant_id', profile.tenant_id).single()
  let resQ = await contractQuery(`
      id, number, origin, start_date, end_date, status, notes, total_amount, daily_rate,
      payment_method, cash_payment, card_payment,
      ${BREAKDOWN_SELECT},
      folio, approval_number, prepared_by, driver_age, client_has_pets, insurance_deductible,
      additional_driver_license, additional_driver_phone, additional_driver2_license, additional_driver2_phone,
      exchange_rate, cash_payment_currency, card_payment_currency,
      clients ( id, full_name, id_type, id_number, license_number, license_expiry, passport_number, phone, email, address, city, state, zip_code, local_phone, local_address ),
      vehicles ( id, plates, brand, model, year, color, vin ),
      reservation_extras ( id, extra_type, description )
    `)
  // Si aún no se aplicó el script SQL, imprimir igual con las columnas de siempre
  if (resQ.error && (resQ.error.code === '42703' || /does not exist/i.test(resQ.error.message))) {
    resQ = await contractQuery(`
      id, number, origin, start_date, end_date, status, notes, total_amount, daily_rate,
      payment_method, cash_payment, card_payment,
      clients ( id, full_name, id_type, id_number, license_number, license_expiry, passport_number, phone, email, address, city, state, zip_code, local_phone, local_address ),
      vehicles ( id, plates, brand, model, year, color, vin ),
      reservation_extras ( id, extra_type, description )
    `)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reservation = resQ.data as any
  const reservationError = resQ.error

  // Una columna que falta en la BD hace fallar la consulta: mostrarlo en lugar de redirigir en silencio
  if (reservationError && reservationError.code !== 'PGRST116') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-800 space-y-2">
          <p className="font-semibold">No se pudo cargar la renta.</p>
          <p className="font-mono text-xs break-words">{reservationError.message}</p>
          {/column .* does not exist/i.test(reservationError.message) && (
            <p>Falta aplicar en Supabase (SQL Editor) el script <b>supabase_contrato_desglose_oct2026.sql</b> de la raíz del proyecto.</p>
          )}
        </div>
      </div>
    )
  }
  if (!reservation) redirect('/dashboard/reservas')

  const client = reservation.clients as unknown as {
    full_name: string; id_type: string; id_number: string;
    license_number: string | null; license_expiry: string | null;
    passport_number: string | null;
    phone: string | null; email: string | null;
    address: string | null; city: string | null; state: string | null;
    zip_code: string | null; local_phone: string | null; local_address: string | null;
  } | null
  // Dirección: preferir el valor del modal (recién guardado) sobre el de BD
  const clientAddress      = spAddress      || client?.address      || ''
  const clientCity         = spCity         || client?.city         || ''
  const clientState        = spState        || client?.state        || ''
  const clientZip          = spZip          || client?.zip_code     || ''
  const clientLocalPhone   = spLocalPhone   || client?.local_phone  || ''
  const clientLocalAddress = spLocalAddress || client?.local_address || ''
  // Licencia / Pasaporte
  const clientLicense  = client?.license_number  || (client?.id_type !== 'passport' ? client?.id_number  : '') || ''
  const clientPassport = client?.passport_number || (client?.id_type === 'passport'  ? client?.id_number  : '') || ''

  const vehicle = reservation.vehicles as unknown as {
    id: string; plates: string; brand: string; model: string;
    year: number; color: string; vin: string | null
  } | null

  const extras = (reservation.reservation_extras ?? []) as {
    id: string; extra_type: string; description: string | null
  }[]

  const { data: checkout } = await supabase
    .from('inspections').select('odometer, fuel_level, notes')
    .eq('reservation_id', id).eq('type', 'checkout').is('swap_id', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  const nights = Math.ceil(
    (new Date(effectiveEnd(reservation.start_date, reservation.end_date)).getTime() - new Date(reservation.start_date).getTime()) / 86400000
  )

  // ── Anexo: equipo entregado y cargos adicionales (documentación de cargos) ──
  const [{ data: annexEquipment }, { data: annexCharges }, { data: annexSwaps }] = await Promise.all([
    supabase
      .from('rental_equipment')
      .select(`assigned_at, returned_at, return_condition, return_notes,
        equipment_items ( code, type, name ),
        assigner:users!rental_equipment_assigned_by_fkey ( full_name ),
        returner:users!rental_equipment_returned_by_fkey ( full_name )`)
      .eq('reservation_id', id)
      .order('assigned_at'),
    supabase
      .from('rental_charges')
      .select('concept, amount, reason, photo_paths, created_at, creator:users!rental_charges_created_by_fkey ( full_name )')
      .eq('reservation_id', id)
      .order('created_at'),
    supabase
      .from('reservation_vehicle_swaps')
      .select(`id, reason, keep_price, swap_at, completed_at, days_used, days_remaining, old_total, new_total, notes,
        from_vehicle:vehicles!reservation_vehicle_swaps_from_vehicle_id_fkey ( brand, model, plates ),
        to_vehicle:vehicles!reservation_vehicle_swaps_to_vehicle_id_fkey ( brand, model, plates ),
        creator:users!reservation_vehicle_swaps_created_by_fkey ( full_name ),
        inspections ( type, odometer, fuel_level )`)
      .eq('reservation_id', id)
      .eq('status', 'completed')
      .order('completed_at'),
  ])
  const oneName = (v: unknown) => ((Array.isArray(v) ? v[0] : v) as { full_name?: string } | null)?.full_name ?? '—'
  const annexPhotoPaths = (annexCharges ?? []).flatMap(c => (c.photo_paths ?? []) as string[])
  const annexSigned: Record<string, string> = {}
  if (annexPhotoPaths.length) {
    const { data: urls } = await supabase.storage.from('inspection-photos').createSignedUrls(annexPhotoPaths, 3600)
    urls?.forEach(u => { if (u.path && u.signedUrl) annexSigned[u.path] = u.signedUrl })
  }
  const annexChargesTotal = (annexCharges ?? []).reduce((acc, c) => acc + Number(c.amount), 0)
  const hasAnnex = (annexEquipment?.length ?? 0) > 0 || (annexCharges?.length ?? 0) > 0 || (annexSwaps?.length ?? 0) > 0
  const swapVeh = (v: unknown) => {
    const o = (Array.isArray(v) ? v[0] : v) as { brand: string; model: string; plates: string } | null
    return o ? `${o.brand} ${o.model} · ${o.plates}` : '—'
  }
  // Todos los montos en US$; la moneda local solo en la tasa y el total final
  const fmtMoney = (n: number) => fmtUSD(n)
  const fmtDT = (d: string) => new Date(d).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })

  // Folio consecutivo: R-0001 (reserva) o C-0001 (contrato de mostrador). El PDF siempre dice "Contrato".
  const contratoNum = reservation.number ? rentalFolio(reservation.origin, reservation.number) : id.slice(0, 8).toUpperCase()
  const companyName = tenant?.name ?? 'Savings Car Rental'
  const s = (tenant?.settings as Record<string, unknown>) ?? {}
  const bizAddress = s.address ? `${L.bizAddress}: ${String(s.address).toUpperCase()}.` : `${L.bizAddress}: AVENIDA VICTOR MANUEL ESPAILLAT UVERAL, LICEY AL MEDIO.`
  const bizCity    = s.city    ? String(s.city).toUpperCase() + '.' : 'AEROPUERTO INTERNACIONAL DEL CIBAO.'
  const bizEmail   = s.email   ? `EMAIL: ${String(s.email).toUpperCase()}` : 'EMAIL: FELIXCASTILLOCARRENTAL@GMAIL.COM'
  const bizEmail2  = s.email_2 ? `EMAIL: ${String(s.email_2).toUpperCase()}` : 'EMAIL: RESERVACIONRENTCAR@GMAIL.COM'
  const bizPhone   = s.phone   ? `${L.bizPhone}: ${String(s.phone)}.` : `${L.bizPhone}: 829-864-3074.`
  const bizRnc     = s.rnc     ? `RNC: ${String(s.rnc)}.` : 'RNC: 131754092.'

  // ── Precios: exactamente los de la reserva (mismo cálculo que Nueva reserva y "Preparar contrato") ──
  const pricing = resolveBreakdown(reservation)
  const bd = pricing.breakdown
  const bLine = (key: string) => bd.lines.find(l => l.key === key)
  const fmtAmt = (n: number | null | undefined) => n != null && n > 0 ? fmtMoney(n) : ''
  const cur      = getCurrencySettings(tenant?.settings)
  const fxRate   = rentalRate(reservation.exchange_rate, cur)
  const cashPaid = Number(reservation.cash_payment) || 0
  const cardPaid = Number(reservation.card_payment) || 0
  const paidUSD  = paymentToUSD(cashPaid, reservation.cash_payment_currency, fxRate) + paymentToUSD(cardPaid, reservation.card_payment_currency, fxRate)
  const balance  = pricing.total - paidUSD
  const totalLocal = toLocal(pricing.total, fxRate)

  // Seguros: aceptado (✓ ACEPTAR) o declinado (✓ DECLINAR). En reservas antiguas sin decisión no se marca.
  // Conceptos de ESTA renta tal como se eligieron (incluye los creados en Configuración)
  const insLines   = bd.lines.filter(l => l.group === 'insurance')
  const extraLines = bd.lines.filter(l => l.group === 'extra')
  const taxLines   = bd.lines.filter(l => l.group === 'tax')
  const insDecision = (key: string): 'a' | 'd' | '' => {
    const l = bLine(key)
    if (l?.checked) return 'a'
    if (pricing.hasSavedBreakdown) return 'd'
    const col = (reservation as Record<string, unknown>)[`insurance_${key}_accepted`]
    return col === false ? 'd' : ''
  }
  const insPrice = (key: string) => {
    const l = bLine(key)
    return l && l.price > 0 ? `${fmtMoney(l.price)}${l.kind === 'per_day' ? L.perDay : ''}` : ''
  }

  // Datos del contrato: lo guardado en la reserva (los parámetros de URL antiguos solo como respaldo)
  const ctFolio      = spFolio        || reservation.folio           || ''
  const ctAprobacion = spAprobacion   || reservation.approval_number || ''
  const ctPreparado  = spPreparadoPor || reservation.prepared_by     || ''
  const pm = reservation.payment_method as string | null
  const payCash = spPago ? spPago === 'efectivo' : pm === 'cash' || pm === 'mixed'
  const payCard = spPago ? spPago === 'tarjeta'  : pm === 'card' || pm === 'mixed'
  const ctD1Lic = spD1Lic || reservation.additional_driver_license  || ''
  const ctD1Tel = spD1Tel || reservation.additional_driver_phone    || ''
  const ctD2Lic = spD2Lic || reservation.additional_driver2_license || ''
  const ctD2Tel = spD2Tel || reservation.additional_driver2_phone   || ''
  const ctEdad  = spEdad  || (reservation.driver_age != null ? String(reservation.driver_age) : '')
  const ctPets  = spMascotas || !!reservation.client_has_pets

  // Hojas adicionales: carta de declinación, seguro de tarjeta y términos y condiciones
  const cardIns = bd.card_insurance ?? null
  const extraCommon = {
    companyName, contratoNum,
    clientName:  client?.full_name ?? '',
    clientDoc:   [clientLicense && `Lic. ${clientLicense}`, clientPassport && `Pas. ${clientPassport}`].filter(Boolean).join(' · '),
    vehicleText: vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year ?? ''} · ${vehicle.plates}` : '',
    periodText:  `${fmt(reservation.start_date)} → ${isOpenEnded(reservation.end_date) ? 'SIN FECHA DE RETORNO' : fmt(reservation.end_date)}`,
    todayText:   new Date().toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  }
  const declinedNames = insLines.filter(l => !l.checked).map(l => l.label)
  const contractTerms = getContractTerms(tenant?.settings, lang)
  const ctDeduct = deductBas || (reservation.insurance_deductible != null ? fmtMoney(Number(reservation.insurance_deductible)) : '')

  const extraDriver = extras.find(e => e.extra_type === 'extra_driver')

  return (
    <>
      <PrintTrigger />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; background: #d1d5db; }
        .screen-bar { background: #1e293b; color: #fff; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
        .screen-bar a { color: #94a3b8; font-size: 12px; text-decoration: none; }
        .screen-bar a:hover { color: #fff; }
        .screen-bar h2 { font-size: 14px; font-weight: 600; }
        .pages { padding: 16px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
        .page { width: 215.9mm; background: #fff; padding: 8mm 9mm; box-shadow: 0 2px 10px rgba(0,0,0,.2); }
        .page-full { padding: 0; }
        .page-full img { display: block; width: 100%; height: auto; margin: 0 auto; object-fit: contain; }
        /* Impresión: sin encabezado ni pie del navegador (fecha, título, URL).
           Al definir cajas de margen en @page, Chrome/Edge omiten sus encabezados
           y pies por defecto; solo dejamos la numeración de páginas. */
        @page {
          size: letter;
          margin: 10mm;
          @top-left { content: none; }
          /* Chrome decide por lado: si arriba no hay ninguna caja con contenido,
             vuelve a poner su encabezado. Un espacio invisible lo evita. */
          @top-center { content: "\\00a0"; }
          @top-right { content: none; }
          @bottom-left { content: none; }
          @bottom-center { content: none; }
          @bottom-right { content: counter(page) "/" counter(pages); font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; }
        }
        @media print {
          body { background: #fff; }
          .screen-bar { display: none !important; }
          .pages { padding: 0; gap: 0; }
          .page { box-shadow: none; width: 100%; padding: 6mm 8mm; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .page-full { padding: 0; }
          .page-full img { max-height: 255mm; }
        }
        /* Helpers */
        .co-title { font-size: 18px; font-weight: 900; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }
        .co-sub { font-size: 10px; font-weight: 700; text-align: center; margin: 2px 0 6px; text-transform: uppercase; }
        table.layout { width: 100%; border-collapse: collapse; }
        td, th { vertical-align: top; }
        .section-hdr { font-size: 8px; font-weight: 700; text-transform: uppercase; background: #000; color: #fff; padding: 2px 4px; margin-bottom: 3px; }
        .bordered { border: 0.7px solid #000; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
        .gap-2 { display: flex; flex-direction: column; gap: 3px; }
        .check-item { display: flex; align-items: flex-start; gap: 3px; font-size: 8px; line-height: 1.3; margin-bottom: 1.5px; }
        .box { display: inline-block; width: 9px; height: 9px; border: 1px solid #000; flex-shrink: 0; margin-top: 1px; }
        .sig-line { border-bottom: 0.7px solid #000; min-height: 18px; margin-top: 2px; }
        .sig-label { font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
        .note-block { font-size: 7px; line-height: 1.35; }
      `}</style>

      {/* Barra de pantalla */}
      <div className="screen-bar">
        <a href={`/dashboard/reservas/${id}`}>← Volver</a>
        <h2>Contrato #{contratoNum}</h2>
        <PrintButton />
      </div>

      <div className="pages">

        {/* ═══════════════════════════════════════════════════
            PÁGINA 1 — CONTRATO DE ALQUILER
        ═══════════════════════════════════════════════════ */}
        <div className="page">

          {/* Cabecera superior */}
          <div style={{ textAlign: 'right', fontSize: 7.5, marginBottom: 2 }}>
            {L.headerTop}
          </div>

          {/* Layout dos columnas */}
          <table className="layout">
            <tbody>
              <tr>

                {/* ── COLUMNA IZQUIERDA ── */}
                <td style={{ width: '42%', paddingRight: 8, verticalAlign: 'top' }}>

                  {/* Logo / empresa */}
                  <div style={{ marginBottom: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logos/Felix_Castillo_CR_Logo-2.png" alt={companyName}
                      style={{ display: 'block', height: 46, width: 'auto', maxWidth: '100%' }} />
                    <div style={{ fontSize: 7.5, lineHeight: 1.5, marginTop: 3, color: '#333' }}>
                      <div>{bizAddress}</div>
                      <div>{bizCity}</div>
                      <div>{bizEmail}</div>
                      <div>{bizEmail2}</div>
                      <div>{bizPhone}</div>
                      <div style={{ fontSize: 6.5, marginTop: 2 }}>RS: {companyName.toUpperCase()} SRL. {bizRnc}</div>
                    </div>
                  </div>

                  {/* Datos del cliente */}
                  <div className="gap-2">
                    <Field label={L.name} value={client?.full_name} />
                    <Field label={L.address} value={clientAddress} />
                    <div className="grid3">
                      <Field label={L.city} value={clientCity} />
                      <Field label={L.state} value={clientState} />
                      <Field label={L.zip} value={clientZip} />
                    </div>
                    <div className="grid2">
                      <Field label={L.license} value={clientLicense} />
                      <Field label={L.passport} value={clientPassport} />
                    </div>
                    <div className="grid2">
                      <Field label={L.contactNum} value={client?.phone} />
                      <Field label={L.localContactNum} value={clientLocalPhone} />
                    </div>

                    {/* Conductor adicional 1 */}
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>{L.additionalDriver}</div>
                    <div className="grid2">
                      <Field label={L.license} value={ctD1Lic} />
                      <Field label={L.contactNum} value={ctD1Tel} />
                    </div>

                    {/* Conductor adicional 2 */}
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>{L.additionalDriver}</div>
                    <div className="grid2">
                      <Field label={L.license} value={ctD2Lic} />
                      <Field label={L.contactNum} value={ctD2Tel} />
                    </div>

                    <Field label={L.localAddress} value={clientLocalAddress} />

                    {/* Observaciones */}
                    <div>
                      <span style={{ fontSize: 7.5, fontWeight: 700 }}>{L.remarks}</span>
                      <div style={{ border: '0.7px solid #000', minHeight: 16, marginTop: 2, padding: '2px 3px', fontSize: 8 }}>
                        {reservation.notes ?? ''}
                      </div>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ borderBottom: '0.5px solid #ccc', minHeight: 13, marginTop: 1 }} />
                      ))}
                    </div>

                    {/* Declaración */}
                    <div className="note-block" style={{ marginTop: 4 }}>
                      {L.declaration}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700 }}>X</span>
                      <div style={{ flex: 1, borderBottom: '0.7px solid #000', minHeight: 18 }} />
                    </div>
                    <div className="note-block" style={{ marginTop: 3 }}>
                      {L.readTerms}
                    </div>
                  </div>

                  {/* Notas al pie */}
                  <div className="note-block" style={{ marginTop: 8, borderTop: '0.7px solid #ccc', paddingTop: 4 }}>
                    {L.note1}<br/>
                    {L.note2}<br/>
                    {L.note3}
                  </div>

                  {/* Avisos (movidos desde la columna derecha) */}
                  <div className="note-block" style={{ border: '0.7px solid #000', padding: '3px 4px', fontSize: 6.5, fontWeight: 700, marginTop: 8 }}>
                    {L.mileageBox}
                  </div>
                  <div className="note-block" style={{ border: '0.7px solid #000', padding: '3px 4px', fontSize: 6.5, fontWeight: 700, marginTop: 6 }}>
                    {L.daysBox}
                  </div>

                </td>

                {/* ── COLUMNA DERECHA ── */}
                <td style={{ width: '58%', verticalAlign: 'top' }}>

                  {/* Cabecera contrato */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 3 }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>{L.depositFolio}</div>
                          <div style={{ minHeight: 12, fontSize: 9 }}>{ctFolio}</div>
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>{L.approvalNum}</div>
                          <div style={{ minHeight: 12, fontSize: 9 }}>{ctAprobacion}</div>
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>{L.preparedBy}</div>
                          <div style={{ minHeight: 12, fontSize: 9 }}>{ctPreparado}</div>
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>{L.paymentMethod}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 7, display:'flex', gap:2, alignItems:'center' }}>
                              <span className="box" style={{ width:8, height:8, background: payCash ? '#000' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:6, fontWeight:900 }}>
                                {payCash ? '✓' : ''}
                              </span> {L.cash}
                            </span>
                            <span style={{ fontSize: 7, display:'flex', gap:2, alignItems:'center' }}>
                              <span className="box" style={{ width:8, height:8, background: payCard ? '#000' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:6, fontWeight:900 }}>
                                {payCard ? '✓' : ''}
                              </span> {L.card}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="gap-2">
                    <div className="grid2">
                      <Field label={L.station} value="" />
                      <Field label={L.contractNum} value={contratoNum} />
                    </div>
                    <div className="grid2">
                      <Field label={L.vehicleMake} value={vehicle ? `${vehicle.brand}` : ''} />
                      <Field label={L.openingDate} value={fmtDate(reservation.start_date)} />
                    </div>
                    <div className="grid3">
                      <div style={{ gridColumn: 'span 1' }}>
                        <Field label={L.vehicleModel} value={vehicle?.model} />
                      </div>
                      <Field label={L.dailyRate} value={fmtAmt(bd.daily_rate)} />
                      <Field label={L.numDays} value={pricing.days || nights} />
                    </div>
                    <div className="grid2">
                      <Field label={L.plate} value={vehicle?.plates} />
                      <Field label={L.color} value={vehicle?.color} />
                    </div>
                    <Field label={L.kmOut} value={checkout?.odometer} />
                    <Field label={L.dateOut} value={fmt(reservation.start_date)} />
                    <Field label={L.dateIn} value={isOpenEnded(reservation.end_date) ? L.openEnded : fmt(reservation.end_date)} />
                    <div className="grid2">
                      <Field label={L.sameCondition} value="" />
                      <Field label={L.driverAge} value={ctEdad} />
                    </div>
                    <div className="grid2">
                      <Field label={L.replMake} value="" />
                      <Field label={L.replModel} value="" />
                    </div>
                    <div className="grid2">
                      <Field label={L.replPlate} value="" />
                      <Field label={L.replColor} value="" />
                    </div>
                    <div className="grid2">
                      <Field label={L.replKmOut} value="" />
                      <Field label={L.replDateOut} value="" />
                    </div>
                    <div className="grid2">
                      <Field label={L.replDateIn} value="" />
                      <div style={{ fontSize: 7.5, display:'flex', alignItems:'center', gap:4 }}>
                        <span className="box" style={{ background: ctPets ? '#000' : '#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:6, fontWeight:900 }}>
                          {ctPets ? '✓' : ''}
                        </span>
                        <span>{L.pets}</span>
                      </div>
                    </div>

                    {/* Tabla de seguros */}
                    <div style={{ marginTop: 3 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000' }}>
                        <tbody>
                          {insLines.map(it => (
                            <InsuranceRow key={it.key} L={L} label={`${it.label.toUpperCase()}:`} price={insPrice(it.key)} status={insDecision(it.key)} />
                          ))}
                          <tr>
                            <td colSpan={4} style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc' }}>
                              {L.deductible} {ctDeduct}
                              {bd.waive_all && <b> · {L.declinedAll}</b>}
                              {cardIns && <b> · {L.cardInsurance(CARD_INSURANCES[cardIns].toUpperCase())}</b>}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Adicionales y totales */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginTop: 2 }}>
                      <tbody>
                        {/* Extras de la reserva (mismos conceptos que Nueva reserva) */}
                        {[
                          ...bd.lines.filter(l => l.group === 'dropoff').map(l => [`DROP OFF: ${l.label.toUpperCase()}`, fmtAmt(l.amount)]),
                          ...extraLines.map(it => [`${L.addOns}: ${it.label.toUpperCase()}${it.checked && it.kind === 'per_day' ? ` (${L.days(bd.days)} × ${fmtMoney(it.price)})` : ''}`, fmtAmt(it.amount)]),
                          ...(bLine('otros')?.checked ? [[`${L.addOns}: ${(bLine('otros')!.label).toUpperCase()}`, fmtAmt(bLine('otros')!.amount)]] : []),
                          ['ADICIONALES: UPGRADE DE VEHÍCULO', ''],
                          ['CARGOS: LIMPIEZA PROFUNDA DEL VEHÍCULO', ''],
                          ['CARGOS: DETALLE Y MISCELÁNEOS', ''],
                        ].filter(([, val]) => val !== '') /* solo lo seleccionado / con monto */
                        .map(([item, val], i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%' }}>{item}</td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}>{val}</td>
                          </tr>
                        ))}
                        {extras.filter(e => !['extra_driver'].includes(e.extra_type)).map(e => (
                          <tr key={e.id}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%' }}>
                              {e.extra_type === 'gps' ? 'GPS' : e.extra_type === 'baby_seat' ? L.babySeat : e.description ?? e.extra_type}
                            </td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}/>
                          </tr>
                        ))}
                        {([
                          [`${L.exchangeRate}: USD - ${cur.localCode}`, fxRate > 0 ? fmtRate(fxRate, cur.localSymbol) : ''],
                          ['DEPÓSITO', ''],
                          [`${L.rental} (${L.days(bd.days)} × ${fmtMoney(bd.daily_rate)})`, fmtAmt(bd.rental_subtotal)],
                          [L.insurance, fmtAmt(bd.insurance_total)],
                          [L.addOns, fmtAmt(bd.extras_total)],
                          [L.subtotal, fmtAmt(bd.subtotal)],
                          ...taxLines.map(it => {
                            const l = bLine(it.key)
                            const rate = l?.checked ? (it.kind === 'pct' ? ` (${l.price}%)` : '') : ' (   )'
                            return [`${L.taxes}: ${it.label.toUpperCase()}${rate}`, l?.checked ? fmtMoney(l.amount) : '']
                          }),
                          ...(pricing.adjustment ? [[L.adjustments, fmtMoney(pricing.adjustment)]] : []),
                          ['DESCUENTOS', ''],
                          ...(cashPaid > 0 ? [[L.cashPayment, fmtPayment(cashPaid, reservation.cash_payment_currency, cur)]] : []),
                          ...(cardPaid > 0 ? [[L.cardPayment, fmtPayment(cardPaid, reservation.card_payment_currency, cur)]] : []),
                          ...(cashPaid + cardPaid > 0 ? [[L.balanceDue, `${fmtMoney(balance)}${fxRate > 0 ? ` (${fmtLocal(toLocal(balance, fxRate), cur.localSymbol)})` : ''}`]] : []),
                        ] as [string, string][]).filter(([, val]) => val !== '') /* solo lo seleccionado / con monto */
                        .map(([label, val], i) => (
                          <tr key={`t${i}`}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%' }}>{label}</td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}>{val}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ fontSize: 8, padding: '2px 3px', fontWeight: 700 }}>{L.totalUsd}</td>
                          <td style={{ fontSize: 8, padding: '2px 3px', borderLeft: '0.5px solid #ccc', fontWeight: 700 }}>{fmtMoney(pricing.total)}</td>
                        </tr>
                        {totalLocal != null && (
                          <tr>
                            <td style={{ fontSize: 8, padding: '2px 3px', fontWeight: 700 }}>{L.totalLocal(cur.localName, cur.localCode)}</td>
                            <td style={{ fontSize: 8, padding: '2px 3px', borderLeft: '0.5px solid #ccc', fontWeight: 700 }}>{fmtLocal(totalLocal, cur.localSymbol)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Cláusulas del contrato */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginTop: 2 }}>
                      <tbody>
                        <tr>
                          <td colSpan={2} style={{ fontSize: 7, padding: '2px 3px', borderBottom: '0.5px solid #000', textAlign: 'center', fontWeight: 700 }}>
                            {L.clauseDecline}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderBottom: '0.5px solid #000', borderRight: '0.5px solid #000', width: '70%' }}>
                            {L.clauseCard}
                          </td>
                          <td style={{ fontSize: 7.5, padding: '2px 3px', borderBottom: '0.5px solid #000', fontWeight: 700, verticalAlign: 'top' }}>
                            {L.deposit}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderRight: '0.5px solid #000', borderBottom: '0.5px solid #000', width: '50%', textAlign: 'center', fontWeight: 700 }}>
                            {L.clauseAge}
                          </td>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderBottom: '0.5px solid #000', textAlign: 'center', fontWeight: 700 }}>
                            {L.clausePets}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderRight: '0.5px solid #000', textAlign: 'center', fontWeight: 700 }}>
                            {L.clauseSmoking}
                          </td>
                          <td style={{ fontSize: 7, padding: '2px 3px', textAlign: 'center', fontWeight: 700 }}>
                            {L.clauseReturn}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>

              </tr>
            </tbody>
          </table>

        </div>{/* fin página 1 */}


        {/* ═══════════════════════════════════════════════════
            PÁGINA 2 — CONTRATO PARTE ATRÁS (documento oficial)
            Imagen generada de public/docs/Contrato Parte Atras.pdf
            (la hoja de condición del vehículo ya no se imprime con el contrato)
        ═══════════════════════════════════════════════════ */}
        <div className="page page-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/docs/contrato-parte-atras.png" alt="Contrato de arrendamiento a corto plazo — parte atrás" />
        </div>{/* fin página 2 */}

        {/* ── Carta de declinación de seguros (provisional) ────────────────── */}
        {bd.waive_all && declinedNames.length > 0 && <WaiverLetter {...extraCommon} declined={declinedNames} />}

        {/* ── Carta oficial del seguro de tarjeta (Visa / Mastercard / Amex) ── */}
        {cardIns && <CardDeclineLetter card={cardIns} cardName={CARD_INSURANCES[cardIns]} />}

        {/* ── Anexo: equipo entregado y cargos adicionales ─────────────────── */}
        {hasAnnex && (
          <div className="page">
            <div className="co-title">{companyName}</div>
            <div className="co-sub">Anexo al contrato No. {contratoNum}</div>

            {(annexSwaps?.length ?? 0) > 0 && (
              <>
                <div className="section-hdr" style={{ marginTop: 6 }}>Cambios de vehículo</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <thead>
                    <tr>
                      {['FECHA', 'VEHÍCULO RECIBIDO', 'VEHÍCULO ENTREGADO', 'MOTIVO', 'PRECIO'].map(h => (
                        <th key={h} style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(annexSwaps ?? []).map(sw => {
                      const insp = (sw.inspections ?? []) as { type: string; odometer: number; fuel_level: string }[]
                      const rec = insp.find(i => i.type === 'checkin')
                      const ent = insp.find(i => i.type === 'checkout')
                      return (
                        <tr key={sw.id}>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5, whiteSpace: 'nowrap' }}>
                            {fmtDT(sw.completed_at ?? sw.swap_at)}<br />{oneName(sw.creator)}
                          </td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>
                            {swapVeh(sw.from_vehicle)}{rec && <><br />KM {rec.odometer.toLocaleString()}</>}
                          </td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>
                            {swapVeh(sw.to_vehicle)}{ent && <><br />KM {ent.odometer.toLocaleString()}</>}
                          </td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>
                            {SWAP_REASONS[sw.reason as SwapReason]?.label}{sw.notes && <><br />{sw.notes}</>}
                          </td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>
                            {sw.keep_price
                              ? 'SIN CAMBIO DE PRECIO'
                              : <>{sw.days_used} DÍA(S) TARIFA ORIGINAL · {sw.days_remaining} DÍA(S) TARIFA NUEVA<br />
                                  TOTAL {sw.old_total != null ? fmtMoney(Number(sw.old_total)) : '—'} → {sw.new_total != null ? fmtMoney(Number(sw.new_total)) : '—'}</>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}

            {(annexEquipment?.length ?? 0) > 0 && (
              <>
                <div className="section-hdr" style={{ marginTop: 6 }}>Equipo entregado al arrendatario</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <thead>
                    <tr>
                      {['CÓDIGO', 'ARTÍCULO', 'ENTREGADO', 'DEVOLUCIÓN', 'OBSERVACIONES'].map(h => (
                        <th key={h} style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(annexEquipment ?? []).map((e, i) => {
                      const it = (Array.isArray(e.equipment_items) ? e.equipment_items[0] : e.equipment_items) as unknown as { code: string; type: string; name: string | null } | null
                      const cond = e.return_condition ? EQUIPMENT_CONDITION[e.return_condition as EquipmentCondition]?.label : null
                      return (
                        <tr key={i}>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700 }}>{it?.code}</td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8 }}>{it?.name || EQUIPMENT_TYPES[it?.type as EquipmentType]?.label}</td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>{fmtDT(e.assigned_at)} · {oneName(e.assigner)}</td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>
                            {e.returned_at ? <>{cond} · {fmtDT(e.returned_at)} · {oneName(e.returner)}</> : 'PENDIENTE'}
                          </td>
                          <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>{e.return_notes ?? ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="note-block" style={{ marginBottom: 8 }}>
                  EL ARRENDATARIO RECIBE EL EQUIPO ARRIBA DESCRITO EN BUEN ESTADO Y SE COMPROMETE A DEVOLVERLO EN LAS MISMAS CONDICIONES.
                  EN CASO DE DAÑO O PÉRDIDA, ACEPTA EL CARGO CORRESPONDIENTE.
                </div>
              </>
            )}

            {(annexCharges?.length ?? 0) > 0 && (
              <>
                <div className="section-hdr">Cargos adicionales</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
                  <thead>
                    <tr>
                      {['FECHA', 'CONCEPTO', 'MOTIVO', 'REGISTRÓ', 'MONTO'].map(h => (
                        <th key={h} style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5, textAlign: h === 'MONTO' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(annexCharges ?? []).map((c, i) => (
                      <tr key={i}>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5, whiteSpace: 'nowrap' }}>{fmtDT(c.created_at)}</td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700 }}>{c.concept}</td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>{c.reason}</td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 7.5 }}>{oneName(c.creator)}</td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoney(Number(c.amount))}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>TOTAL CARGOS ADICIONALES:</td>
                      <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>{fmtMoney(annexChargesTotal)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Evidencia fotográfica */}
                {annexPhotoPaths.some(p => annexSigned[p]) && (
                  <>
                    <div style={{ fontSize: 7.5, fontWeight: 700, margin: '4px 0 3px' }}>EVIDENCIA FOTOGRÁFICA:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {annexPhotoPaths.filter(p => annexSigned[p]).map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={annexSigned[p]} alt={`Evidencia ${i + 1}`} style={{ width: '31%', aspectRatio: '4 / 3', objectFit: 'cover', border: '0.7px solid #000' }} />
                      ))}
                    </div>
                  </>
                )}

                <div className="note-block" style={{ marginBottom: 10 }}>
                  EL ARRENDATARIO RECONOCE Y ACEPTA LOS CARGOS ADICIONALES DESCRITOS, QUE SE SUMAN AL MONTO DEL CONTRATO No. {contratoNum},
                  Y AUTORIZA SU COBRO POR EL MISMO MEDIO DE PAGO UTILIZADO EN LA RENTA.
                </div>
              </>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <tbody>
                <tr>
                  <td style={{ border: '0.7px solid #000', padding: '2px 4px', width: '50%' }}>
                    <div className="sig-label">FIRMA DEL CLIENTE (ACEPTO):</div>
                    <div className="sig-line" style={{ minHeight: 28 }} />
                  </td>
                  <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                    <div className="sig-label">FIRMA DE QUIEN REGISTRA:</div>
                    <div className="sig-line" style={{ minHeight: 28 }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Términos y condiciones (siempre) ─────────────────────────────── */}
        <TermsPage {...extraCommon} terms={contractTerms} lang={lang} />

      </div>
    </>
  )
}
