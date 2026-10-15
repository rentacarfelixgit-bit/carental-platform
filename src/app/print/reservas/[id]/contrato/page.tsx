// src/app/print/reservas/[id]/contrato/page.tsx
// Contrato imprimible — layout fiel al contrato físico de Felix Castillo Car Rental

import { createClient } from '@/lib/supabase/server'
import { rentalFolio } from '@/lib/rentalLabels'
import { EQUIPMENT_CONDITION, EQUIPMENT_TYPES, type EquipmentCondition, type EquipmentType } from '@/lib/equipment'
import { SWAP_REASONS, type SwapReason } from '@/lib/vehicleSwap'
import { redirect } from 'next/navigation'
import PrintTrigger from './PrintTrigger'
import PrintButton from './PrintButton'

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

// ─── Imágenes del vehículo desde /public ──────────────────────────────────
const imgStyle: React.CSSProperties = { width: '100%', height: 'auto', maxHeight: 130, objectFit: 'contain', display: 'block' }
const imgStyleTop: React.CSSProperties = { width: '100%', height: 'auto', maxHeight: 160, objectFit: 'contain', display: 'block' }

// ─── Gauge de combustible ──────────────────────────────────────────────────
function FuelGauge({ level, small }: { level?: string; small?: boolean }) {
  const map: Record<string, number> = { empty:0, quarter:2, half:4, three_quarters:6, full:8 }
  const selected = level ? (map[level] ?? -1) : -1
  const slots = ['E','1/8','2/8','3/8','4/8','5/8','6/8','7/8','F']
  const fs = small ? 7 : 8
  const bw = small ? 20 : 24
  const bh = small ? 14 : 16
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {slots.map((s, i) => (
        <div key={i} style={{
          width: bw, height: bh,
          border: '1px solid #000',
          borderLeft: i === 0 ? '1px solid #000' : 'none',
          background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: fs, fontWeight: 400,
          color: '#000',
        }}>{s}</div>
      ))}
    </div>
  )
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
function InsuranceRow({ label, price, status }: { label: string; price?: string; status?: 'a' | 'd' | '' }) {
  const check = '✓'
  return (
    <tr>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '45%' }}>{label}</td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%' }}>
        PRECIO: {price ?? ''}
      </td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%', fontWeight: status === 'a' ? 700 : 400 }}>
        ACEPTAR: {status === 'a' ? check : ''}
      </td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '19%', fontWeight: status === 'd' ? 700 : 400 }}>
        DECLINAR: {status === 'd' ? check : ''}
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
  type InsStatus = 'a' | 'd' | ''
  const ins = (key: string): InsStatus => { const v = p(key); return (v === 'a' || v === 'd') ? v : '' }
  const segCdw = ins('seg_cdw')
  const segLia = ins('seg_lia')
  const segTw  = ins('seg_tw')
  const segAt  = ins('seg_at')
  const segPkg = ins('seg_pkg')
  const segBas = ins('seg_bas')
  const priceCdw  = p('price_cdw',  12)
  const priceLia  = p('price_lia',  12)
  const priceTw   = p('price_tw',   12)
  const priceAt   = p('price_at',   12)
  const pricePkg  = p('price_pkg',  12)
  const priceBas  = p('price_bas',  12)
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
  const { data: reservation } = await supabase
    .from('reservations')
    .select(`
      id, number, origin, start_date, end_date, status, notes, total_amount,
      clients ( id, full_name, id_type, id_number, license_number, license_expiry, passport_number, phone, email, address, city, state, zip_code, local_phone, local_address ),
      vehicles ( id, plates, brand, model, year, color, vin ),
      reservation_extras ( id, extra_type, description )
    `)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

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
    .eq('reservation_id', id).eq('type', 'checkout').is('swap_id', null).maybeSingle()

  const { data: checkin } = await supabase
    .from('inspections').select('odometer, fuel_level, notes')
    .eq('reservation_id', id).eq('type', 'checkin').is('swap_id', null).maybeSingle()

  const nights = Math.ceil(
    (new Date(reservation.end_date).getTime() - new Date(reservation.start_date).getTime()) / 86400000
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
  const fmtRD = (n: number) => `RD$${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDT = (d: string) => new Date(d).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })

  // Folio consecutivo: R-0001 (reserva) o C-0001 (contrato de mostrador). El PDF siempre dice "Contrato".
  const contratoNum = reservation.number ? rentalFolio(reservation.origin, reservation.number) : id.slice(0, 8).toUpperCase()
  const companyName = tenant?.name ?? 'Savings Car Rental'
  const s = (tenant?.settings as Record<string, unknown>) ?? {}
  const bizAddress = s.address ? `DIRECCIÓN: ${String(s.address).toUpperCase()}.` : 'DIRECCIÓN: AVENIDA VICTOR MANUEL ESPAILLAT UVERAL, LICEY AL MEDIO.'
  const bizCity    = s.city    ? String(s.city).toUpperCase() + '.' : 'AEROPUERTO INTERNACIONAL DEL CIBAO.'
  const bizEmail   = s.email   ? `EMAIL: ${String(s.email).toUpperCase()}` : 'EMAIL: FELIXCASTILLOCARRENTAL@GMAIL.COM'
  const bizEmail2  = s.email_2 ? `EMAIL: ${String(s.email_2).toUpperCase()}` : 'EMAIL: RESERVACIONRENTCAR@GMAIL.COM'
  const bizPhone   = s.phone   ? `TELÉFONO: ${String(s.phone)}.` : 'TELÉFONO: 829-864-3074.'
  const bizRnc     = s.rnc     ? `RNC: ${String(s.rnc)}.` : 'RNC: 131754092.'

  // ── Impuestos ───────────────────────────────────────────────────────────────
  const taxItbis   = Boolean(s.tax_itbis)
  const taxAirport = Boolean(s.tax_airport)
  const taxDigital = Boolean(s.tax_digital)

  const dailyRate  = reservation.total_amount
    ? Number(reservation.total_amount) / nights
    : null
  const subtotal   = dailyRate ? dailyRate * nights : null
  const itbisAmt   = (subtotal && taxItbis)   ? subtotal * 0.18 : null
  const airportAmt = (subtotal && taxAirport) ? subtotal * 0.10 : null
  const digitalAmt = (subtotal && taxDigital) ? subtotal * 0.05 : null
  const totalTaxes = (itbisAmt ?? 0) + (airportAmt ?? 0) + (digitalAmt ?? 0)
  const totalUSD   = subtotal ? subtotal + totalTaxes : null

  const fmtAmt = (n: number | null) => n != null ? `$${n.toFixed(2)}` : ''

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
        @media print {
          body { background: #fff; }
          .screen-bar { display: none !important; }
          .pages { padding: 0; gap: 0; }
          .page { box-shadow: none; width: 100%; padding: 6mm 8mm; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
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
            CONTRATO DE ALQUILER PARTE FRONTAL, ALQUILER MÁXIMO 30 DÍAS.
          </div>

          {/* Layout dos columnas */}
          <table className="layout">
            <tbody>
              <tr>

                {/* ── COLUMNA IZQUIERDA ── */}
                <td style={{ width: '42%', paddingRight: 8, verticalAlign: 'top' }}>

                  {/* Logo / empresa */}
                  <div style={{ marginBottom: 6 }}>
                    <div className="co-title">{companyName}</div>
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
                    <Field label="NOMBRE" value={client?.full_name} />
                    <Field label="DIRECCIÓN" value={clientAddress} />
                    <div className="grid3">
                      <Field label="CIUDAD" value={clientCity} />
                      <Field label="ESTADO" value={clientState} />
                      <Field label="ZIP CODE" value={clientZip} />
                    </div>
                    <div className="grid2">
                      <Field label="LICENCIA" value={clientLicense} />
                      <Field label="PASAPORTE" value={clientPassport} />
                    </div>
                    <div className="grid2">
                      <Field label="NUM. DE CONTACTO" value={client?.phone} />
                      <Field label="NUM. DE CONTACTO LOCAL" value={clientLocalPhone} />
                    </div>

                    {/* Conductor adicional 1 */}
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>CONDUCTOR ADICIONAL:</div>
                    <div className="grid2">
                      <Field label="LICENCIA" value={spD1Lic} />
                      <Field label="NUM. DE CONTACTO" value={spD1Tel} />
                    </div>

                    {/* Conductor adicional 2 */}
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>CONDUCTOR ADICIONAL:</div>
                    <div className="grid2">
                      <Field label="LICENCIA" value={spD2Lic} />
                      <Field label="NUM. DE CONTACTO" value={spD2Tel} />
                    </div>

                    <Field label="DIRECCIÓN LOCAL" value={clientLocalAddress} />

                    {/* Observaciones */}
                    <div>
                      <span style={{ fontSize: 7.5, fontWeight: 700 }}>OBSERVACIONES / DETALLE:</span>
                      <div style={{ border: '0.7px solid #000', minHeight: 16, marginTop: 2, padding: '2px 3px', fontSize: 8 }}>
                        {reservation.notes ?? ''}
                      </div>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ borderBottom: '0.5px solid #ccc', minHeight: 13, marginTop: 1 }} />
                      ))}
                    </div>

                    {/* Declaración */}
                    <div className="note-block" style={{ marginTop: 4 }}>
                      LOS DATOS SUMINISTRADOS POR EL ARRENDATARIO SON VERÍDICOS Y ENTREGADOS DE MANERA VOLUNTARIA:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700 }}>X</span>
                      <div style={{ flex: 1, borderBottom: '0.7px solid #000', minHeight: 18 }} />
                    </div>
                    <div className="note-block" style={{ marginTop: 3 }}>
                      HE LEÍDO LOS TÉRMINOS Y CONDICIONES DE ESTE CONTRATO, DICHO ESTO,
                      PROCEDO A FIRMAR CONFORME Y VOLUNTARIAMENTE LO ESTABLECIDO EN EL MISMO.
                    </div>
                  </div>

                  {/* Notas al pie */}
                  <div className="note-block" style={{ marginTop: 8, borderTop: '0.7px solid #ccc', paddingTop: 4 }}>
                    1. EL ARRENDATARIO ES RESPONSABLE POR MULTAS DE TRÁFICO.<br/>
                    2. EL MÍNIMO DE RENTA ES DE UN DÍA.<br/>
                    3. EL ARRENDATARIO DEBE PRESENTARSE AL FINALIZAR EL PERÍODO DE RENTA ACORDADO
                    TANTO PARA RETORNAR LA UNIDAD O PARA EXTENDER EL CONTRATO.
                  </div>

                </td>

                {/* ── COLUMNA DERECHA ── */}
                <td style={{ width: '58%', verticalAlign: 'top' }}>

                  {/* Cabecera contrato */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 3 }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>FOLIO DEL DEPST.</div>
                          <div style={{ minHeight: 12, fontSize: 9 }}>{spFolio}</div>
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>NUM. DE APROB.</div>
                          <div style={{ minHeight: 12, fontSize: 9 }}>{spAprobacion}</div>
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>PREPARADO POR:</div>
                          <div style={{ minHeight: 12, fontSize: 9 }}>{spPreparadoPor}</div>
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>FORMA DE PAGO:</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 7, display:'flex', gap:2, alignItems:'center' }}>
                              <span className="box" style={{ width:8, height:8, background: spPago === 'efectivo' ? '#000' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:6, fontWeight:900 }}>
                                {spPago === 'efectivo' ? '✓' : ''}
                              </span> EFECTIVO
                            </span>
                            <span style={{ fontSize: 7, display:'flex', gap:2, alignItems:'center' }}>
                              <span className="box" style={{ width:8, height:8, background: spPago === 'tarjeta' ? '#000' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:6, fontWeight:900 }}>
                                {spPago === 'tarjeta' ? '✓' : ''}
                              </span> TARJETA
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="gap-2">
                    <div className="grid2">
                      <Field label="ESTACIÓN / OFICINA" value="" />
                      <Field label="NUM. DE CONTRATO" value={contratoNum} />
                    </div>
                    <div className="grid2">
                      <Field label="MARCAR DEL VEHÍCULO" value={vehicle ? `${vehicle.brand}` : ''} />
                      <div className="note-block" style={{ border: '0.7px solid #000', padding: '2px 3px', fontSize: 6.5, fontWeight: 700, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                        LOS VEHICULOS TIENEN KILOMETRAJE ILIMITADO PERO SOLO PUEDEN SER TRANSITADOS EN TERRITORIO DE LA REPUBLICA DOMINICANA.
                      </div>
                    </div>
                    <Field label="FECHA DE APERTURA DEL CONTRATO" value={fmtDate(reservation.start_date)} />
                    <div className="grid3">
                      <div style={{ gridColumn: 'span 1' }}>
                        <Field label="MODELO DEL VEHÍCULO" value={vehicle?.model} />
                      </div>
                      <Field label="PRECIO POR DÍA" value="" />
                      <Field label="CANTIDAD DE DÍAS" value={nights} />
                    </div>
                    <div className="grid2">
                      <Field label="PLACA DEL VEHÍCULO" value={vehicle?.plates} />
                      <div className="note-block" style={{ border: '0.7px solid #000', padding: '2px 3px', fontSize: 6.5, fontWeight: 700, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                        LA CANTIDAD DE DIAS ES CALCULADA EN FORMATO DE 24 HORAS PARTIENDO DE LA HORA EN LA QUE EL ARRENDATARIO RECIBE EL VEHICULO. EL DIA DE RETORNO DEBE SER A LA MISMA HORA. PASADAS LAS 4 HORAS SE PROCEDERA A CARGAR 1 DIA EXTRA.
                      </div>
                    </div>
                    <Field label="COLOR DEL VEHÍCULO" value={vehicle?.color} />
                    <Field label="KM DE SALIDA DEL VEHÍCULO" value={checkout?.odometer} />
                    <Field label="FECHA SALIDA DEL VEHÍCULO" value={fmt(reservation.start_date)} />
                    <Field label="FECHA ENTRADA DEL VEHÍCULO" value={fmt(reservation.end_date)} />
                    <div className="grid2">
                      <Field label="VEHÍCULO RETORNA EN LAS MISMAS CONDICIONES" value="" />
                      <Field label="EDAD DEL CONDUCTOR" value={spEdad} />
                    </div>
                    <div className="grid2">
                      <Field label="REEMPLAZO DE VEHÍCULO MARCAR" value="" />
                      <Field label="REEMPLAZO DE VEHÍCULO MODELO" value="" />
                    </div>
                    <div className="grid2">
                      <Field label="REEMPLAZO DE VEHÍCULO PLACA" value="" />
                      <Field label="REEMPLAZO DE VEHÍCULO COLOR" value="" />
                    </div>
                    <div className="grid2">
                      <Field label="KM DE SALIDA (REEMPLAZO)" value="" />
                      <Field label="FECHA SALIDA (REEMPLAZO)" value="" />
                    </div>
                    <div className="grid2">
                      <Field label="FECHA ENTRADA (REEMPLAZO)" value="" />
                      <div style={{ fontSize: 7.5, display:'flex', alignItems:'center', gap:4 }}>
                        <span className="box" style={{ background: spMascotas ? '#000' : '#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:6, fontWeight:900 }}>
                          {spMascotas ? '✓' : ''}
                        </span>
                        <span>CLIENTE TIENE MASCOTAS / PETS:</span>
                      </div>
                    </div>

                    {/* Tabla de seguros */}
                    <div style={{ marginTop: 3 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000' }}>
                        <tbody>
                          <InsuranceRow label="SEGURO DE COLISIÓN — CDW:"                     price={priceCdw} status={segCdw} />
                          <InsuranceRow label="SEG. DAÑOS A TERCEROS — LIABILITY:"            price={priceLia} status={segLia} />
                          <InsuranceRow label="SEG. GOMAS Y CRISTALES — TIRES AND WINDSHIELD:" price={priceTw}  status={segTw}  />
                          <InsuranceRow label="SEG. ANTI-ROBOS — ANTI-THEFT:"                 price={priceAt}  status={segAt}  />
                          <InsuranceRow label="PAQUETE DE SEGUROS CDW / LIA / TW / AT:"       price={pricePkg} status={segPkg} />
                          <tr>
                            <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '45%' }}>SEGURO BÁSICO — LIA / TW:</td>
                            <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%' }}>PRECIO: {priceBas}</td>
                            <td colSpan={2} style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}>DEDUCIBLE: {deductBas}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Adicionales y totales */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginTop: 2 }}>
                      <tbody>
                        {[
                          'TANQUE PRE-PAGO DE COMBUSTIBLE',
                          'LAVADO DEL VEHÍCULO',
                          'WIFI HOTSPOT',
                          'UPGRADE DE VEHÍCULO',
                          'CARGOS: LIMPIEZA PROFUNDA DEL VEHÍCULO',
                          'CARGOS: DETALLE Y MISCELÁNEOS',
                        ].map((item, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%' }}>ADICIONALES: {item}</td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}/>
                          </tr>
                        ))}
                        {extras.filter(e => !['extra_driver'].includes(e.extra_type)).map(e => (
                          <tr key={e.id}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%' }}>
                              {e.extra_type === 'gps' ? 'GPS' : e.extra_type === 'baby_seat' ? 'SILLA DE BEBÉ' : e.description ?? e.extra_type}
                            </td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}/>
                          </tr>
                        ))}
                        {([
                          ['TASA DE CAMBIO: USD - RD', ''],
                          ['DEPÓSITO', ''],
                          ['SUB-TOTAL', fmtAmt(subtotal)],
                          ...(taxItbis   ? [['IMPUESTOS: ITBIS (18%)',            fmtAmt(itbisAmt)]]   : [['IMPUESTOS: ITBIS (   )', '']]),
                          ...(taxAirport ? [['IMPUESTOS: AEROPORTUARIO (10%)',    fmtAmt(airportAmt)]] : [['IMPUESTOS: AIRPORT (   )', '']]),
                          ...(taxDigital ? [['IMPUESTOS: PAGOS DIGITALES (5%)',   fmtAmt(digitalAmt)]] : []),
                          ['DESCUENTOS', ''],
                        ] as [string, string][]).map(([label, val], i) => (
                          <tr key={`t${i}`}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%' }}>{label}</td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}>{val}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ fontSize: 8, padding: '2px 3px', fontWeight: 700 }}>TOTAL EN DÓLARES (USD):</td>
                          <td style={{ fontSize: 8, padding: '2px 3px', borderLeft: '0.5px solid #ccc', fontWeight: 700 }}>{fmtAmt(totalUSD)}</td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 8, padding: '2px 3px', fontWeight: 700 }}>TOTAL EN PESOS (RD):</td>
                          <td style={{ fontSize: 8, padding: '2px 3px', borderLeft: '0.5px solid #ccc', fontWeight: 700 }}/>
                        </tr>
                      </tbody>
                    </table>

                    {/* Cláusulas del contrato */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginTop: 2 }}>
                      <tbody>
                        <tr>
                          <td colSpan={2} style={{ fontSize: 7, padding: '2px 3px', borderBottom: '0.5px solid #000', textAlign: 'center', fontWeight: 700 }}>
                            EL ARRENDATERO ESTA EN EL DERECHO DE DECLINAR TODOS LOS SEGUROS PERO SE HARA RESPONSABLE EN SU TOTALIDAD A CUALQUIER DAÑO O SITUACION QUE PRESENTE EL VEHICULO DURANTE EL PERIODO DE RENTA.
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderBottom: '0.5px solid #000', borderRight: '0.5px solid #000', width: '70%' }}>
                            EL ARRENDATARIO PARA OPTAR AL DERECHO DE DECLINAR TODOS LOS SEGUROS DEBE DE TENER UNA TARJETA DE DEBITO O CREDITO CON UNA CANTIDAD DE DINERO DISPONIBLE PARA HACER UN DEPOSITO.
                          </td>
                          <td style={{ fontSize: 7.5, padding: '2px 3px', borderBottom: '0.5px solid #000', fontWeight: 700, verticalAlign: 'top' }}>
                            DEPOSITO:
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderRight: '0.5px solid #000', borderBottom: '0.5px solid #000', width: '50%', textAlign: 'center', fontWeight: 700 }}>
                            EL CONDUCTOR Y CONOC. ADICN. DEBEN TENER 25 AÑOS DE EDAD PARA CONDUCIR EL VEHICULO, DE SER MENOR DE 25 AÑOS DEBERA PAGAR UN CARGO EXTRA.
                          </td>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderBottom: '0.5px solid #000', textAlign: 'center', fontWeight: 700 }}>
                            LAS MASCOTAS ESTAN PERMITIDAS DENTRO DEL VEHICULO PERO MANTENER LA LIMPIEZA DEL VEHICULO ES TOTAL RESPONSABILIDAD DEL ARRENDATARIO.
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontSize: 7, padding: '2px 3px', borderRight: '0.5px solid #000', textAlign: 'center', fontWeight: 700 }}>
                            ESTA PROHIBIDO FUMAR DENTRO DEL VEHICULO. DE NO RESPETAR ESTA NORMA SE INCURRIRA EN CARGOS ADICIONALES.
                          </td>
                          <td style={{ fontSize: 7, padding: '2px 3px', textAlign: 'center', fontWeight: 700 }}>
                            EL ARRENDATARIO DEBE RETORNAR EL VEHICULO EN EL MISMO ESTADO EN QUE LO RECIBIO: MISMA CANTIDAD DE COMBUSTIBLE, MISMO NIVEL DE LIMPIEZA E HIGIENE.
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
            PÁGINA 2 — CONDICIÓN DEL VEHÍCULO
        ═══════════════════════════════════════════════════ */}
        <div className="page">

          {/* Encabezado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div className="co-title" style={{ fontSize: 16 }}>{companyName}</div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>No.: {contratoNum}</div>
          </div>

          {/* Info básica */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginBottom: 4 }}>
            <tbody>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px', width: '40%' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>NOMBRE:</div>
                  <div style={{ fontSize: 9 }}>{client?.full_name ?? ''}</div>
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px', width: '20%' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>CATEGORÍA:</div>
                  <div style={{ fontSize: 9 }}/>
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px', width: '20%' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>FICHA DEL VEHÍCULO:</div>
                  <div style={{ fontSize: 9 }}>{vehicle?.id?.slice(0,8).toUpperCase() ?? ''}</div>
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px', width: '20%' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>PLACA DEL VEHÍCULO:</div>
                  <div style={{ fontSize: 9 }}>{vehicle?.plates ?? ''}</div>
                </td>
              </tr>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>CONTRATO NUM.:</div>
                  <div style={{ fontSize: 9 }}>{contratoNum}</div>
                </td>
                <td colSpan={2} style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>COLOR DEL VEHÍCULO:</div>
                  <div style={{ fontSize: 9 }}>{vehicle?.color ?? ''}</div>
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7, fontWeight: 700 }}>MODELO DEL VEHÍCULO:</div>
                  <div style={{ fontSize: 9 }}>{vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : ''}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Diagramas del vehículo */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginBottom: 4 }}>
            <tbody>
              {/* Fila 1: Delantera | título | Trasera */}
              <tr>
                <td style={{ width: '40%', border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2 }}>DELANTERA</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Frente.jfif" alt="Frente" style={imgStyle} />
                </td>
                <td style={{ width: '20%', border: '0.7px solid #000', padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>CONDICIÓN<br/>DEL<br/>VEHÍCULO</div>
                </td>
                <td style={{ width: '40%', border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2, textAlign: 'right' }}>TRASERA</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Trasera.jfif" alt="Trasera" style={imgStyle} />
                </td>
              </tr>
              {/* Fila 2: Lateral izq | Chequeo exterior */}
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2 }}>LATERAL IZQUIERDO</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Izquierda.jfif" alt="Lateral Izquierdo" style={imgStyle} />
                </td>
                <td colSpan={2} style={{ border: '0.7px solid #000', padding: '4px 8px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, marginBottom: 3 }}>CHEQUEO EXTERIOR :</div>
                  {['MICAS / PANTALLAS.', 'LLAVE DE RUEDAS.', 'GOMA DE REPUESTO.', 'TAPA BOCINAS.', 'LIMPIAVIDRIOS.', 'ESPEJOS RETROV.', 'TAPA COMBUSTIBLE.', 'CRISTALES.', 'ANTENA.'].map(item => (
                    <div key={item} className="check-item"><span className="box"/><span>{item}</span></div>
                  ))}
                </td>
              </tr>
              {/* Fila 3: Chequeo interior | Lateral derecho */}
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '4px 8px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, marginBottom: 3 }}>CHEQUEO INTERIOR :</div>
                  {['CONTROL DE ALARMAS.', 'ALFROMBRAS.', 'ASIENTOS.', 'REJILLAS DE AIRE.', 'LUCES DE INTERIOR.', 'CINTURÓN DE SEG.', 'ESPEJOS RETROV.', 'DOCUMENTOS.', 'CARGADORES.'].map(item => (
                    <div key={item} className="check-item"><span className="box"/><span>{item}</span></div>
                  ))}
                </td>
                <td colSpan={2} style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2, textAlign: 'right' }}>LATERAL DERECHO</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Derecha.jfif" alt="Lateral Derecho" style={imgStyle} />
                </td>
              </tr>
              {/* Fila 4: Baúl / Bonete / Techo - full width */}
              <tr>
                <td colSpan={3} style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2 }}>BAÚL / BONETE / TECHO</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 260 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/Arriba.jfif" alt="Vista Superior" style={imgStyleTop} />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Salida / Entrada */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000', marginBottom: 4 }}>
            <thead>
              <tr>
                <th style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700, width: '50%', textAlign: 'left', background: '#f0f0f0' }}>
                  SALIDA DEL VEHÍCULO
                </th>
                <th style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700, width: '50%', textAlign: 'left', background: '#f0f0f0' }}>
                  ENTRADA DEL VEHÍCULO
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <Field label="ESTACIÓN" value="" />
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <Field label="ESTACIÓN" value="" />
                </td>
              </tr>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '3px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 3 }}>NIVEL DE COMBUSTIBLE:</div>
                  <FuelGauge level={checkout?.fuel_level ?? undefined} small />
                </td>
                <td style={{ border: '0.7px solid #000', padding: '3px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 3 }}>NIVEL DE COMBUSTIBLE:</div>
                  <FuelGauge level={checkin?.fuel_level ?? undefined} small />
                </td>
              </tr>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <Field label="FECHA - HORA" value={fmt(reservation.start_date)} />
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <Field label="FECHA - HORA" value={fmt(reservation.end_date)} />
                </td>
              </tr>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <Field label="ODÓMETRO (KM)" value={checkout?.odometer} />
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <Field label="ODÓMETRO (KM)" value={checkin?.odometer} />
                </td>
              </tr>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 1 }}>OBSERVACIONES:</div>
                  <div style={{ minHeight: 28, fontSize: 8 }}>{checkout?.notes ?? ''}</div>
                </td>
                <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 1 }}>OBSERVACIONES:</div>
                  <div style={{ minHeight: 28, fontSize: 8 }}>{checkin?.notes ?? ''}</div>
                </td>
              </tr>
              {/* Firmas */}
              {[
                ['FIRMA DE QUIEN ENTREGA EL VEHÍCULO:', 'FIRMA DE QUIEN RECIBE EL VEHÍCULO:'],
                ['FIRMA DEL COND. ADICIONAL:', 'FIRMA DEL COND. ADICIONAL:'],
                ['FIRMA DEL CLIENTE:', 'FIRMA DEL CLIENTE:'],
              ].map(([l, r], i) => (
                <tr key={i}>
                  <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                    <div className="sig-label">{l}</div>
                    <div className="sig-line" />
                  </td>
                  <td style={{ border: '0.7px solid #000', padding: '2px 4px' }}>
                    <div className="sig-label">{r}</div>
                    <div className="sig-line" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pie de página */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000' }}>
            <tbody>
              <tr>
                <td style={{ border: '0.7px solid #000', padding: '3px 5px', width: '55%', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2 }}>INFORMACIÓN:</div>
                  <div className="note-block">
                    {bizCity}<br/>
                    {bizEmail}<br/>
                    {bizEmail2}<br/>
                    {bizPhone}<br/>
                    RS: {companyName.toUpperCase()} SRL. {bizRnc}
                  </div>
                </td>
                <td style={{ border: '0.7px solid #000', padding: '3px 5px', verticalAlign: 'top' }}>
                  <div style={{ fontSize: 7.5, fontWeight: 700, marginBottom: 2 }}>COMENTARIO DEL AUXILIAR:</div>
                  <div style={{ minHeight: 36 }} />
                </td>
              </tr>
            </tbody>
          </table>

        </div>{/* fin página 2 */}

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
                                  TOTAL {sw.old_total != null ? fmtRD(Number(sw.old_total)) : '—'} → {sw.new_total != null ? fmtRD(Number(sw.new_total)) : '—'}</>}
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
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtRD(Number(c.amount))}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>TOTAL CARGOS ADICIONALES:</td>
                      <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, fontWeight: 700, textAlign: 'right' }}>{fmtRD(annexChargesTotal)}</td>
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

      </div>
    </>
  )
}
