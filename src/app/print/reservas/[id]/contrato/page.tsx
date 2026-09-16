// src/app/print/reservas/[id]/contrato/page.tsx
// Contrato imprimible — layout fiel al contrato físico de Felix Castillo Car Rental

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrintTrigger from './PrintTrigger'
import PrintButton from './PrintButton'

interface Props { params: Promise<{ id: string }> }

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
function InsuranceRow({ label }: { label: string }) {
  return (
    <tr>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '45%' }}>{label}</td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%' }}>PRECIO:</td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%' }}>ACEPTAR:</td>
      <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '19%' }}>DECLINAR:</td>
    </tr>
  )
}

export default async function ContratoPrintPage({ params }: Props) {
  const { id } = await params

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
      id, start_date, end_date, status, notes,
      clients ( id, full_name, id_type, id_number, license_number, license_expiry, phone, email ),
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
    phone: string | null; email: string | null
  } | null

  const vehicle = reservation.vehicles as unknown as {
    id: string; plates: string; brand: string; model: string;
    year: number; color: string; vin: string | null
  } | null

  const extras = (reservation.reservation_extras ?? []) as {
    id: string; extra_type: string; description: string | null
  }[]

  const { data: checkout } = await supabase
    .from('inspections').select('odometer, fuel_level, notes')
    .eq('reservation_id', id).eq('type', 'checkout').maybeSingle()

  const { data: checkin } = await supabase
    .from('inspections').select('odometer, fuel_level, notes')
    .eq('reservation_id', id).eq('type', 'checkin').maybeSingle()

  const nights = Math.ceil(
    (new Date(reservation.end_date).getTime() - new Date(reservation.start_date).getTime()) / 86400000
  )

  const contratoNum = id.slice(0, 8).toUpperCase()
  const companyName = tenant?.name ?? 'Savings Car Rental'
  const s = (tenant?.settings as Record<string, string>) ?? {}
  const bizAddress = s.address ? `DIRECCIÓN: ${s.address.toUpperCase()}.` : 'DIRECCIÓN: AVENIDA VICTOR MANUEL ESPAILLAT UVERAL, LICEY AL MEDIO.'
  const bizCity    = s.city    ? s.city.toUpperCase() + '.' : 'AEROPUERTO INTERNACIONAL DEL CIBAO.'
  const bizEmail   = s.email   ? `EMAIL: ${s.email.toUpperCase()}` : 'EMAIL: FELIXCASTILLOCARRENTAL@GMAIL.COM'
  const bizEmail2  = s.email_2 ? `EMAIL: ${s.email_2.toUpperCase()}` : 'EMAIL: RESERVACIONRENTCAR@GMAIL.COM'
  const bizPhone   = s.phone   ? `TELÉFONO: ${s.phone}.` : 'TELÉFONO: 829-864-3074.'
  const bizRnc     = s.rnc     ? `RNC: ${s.rnc}.` : 'RNC: 131754092.'

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
                    <Field label="DIRECCIÓN" value="" />
                    <div className="grid3">
                      <Field label="CIUDAD" value="" />
                      <Field label="ESTADO" value="" />
                      <Field label="ZIP CODE" value="" />
                    </div>
                    <div className="grid2">
                      <Field label="LICENCIA" value={client?.id_type !== 'passport' ? client?.id_number : ''} />
                      <Field label="PASAPORTE" value={client?.id_type === 'passport' ? client?.id_number : ''} />
                    </div>
                    <div className="grid2">
                      <Field label="NUM. DE CONTACTO" value={client?.phone} />
                      <Field label="NUM. DE CONTACTO LOCAL" value="" />
                    </div>

                    {/* Conductor adicional 1 */}
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>CONDUCTOR ADICIONAL:</div>
                    <Field label="LICENCIA" value={extraDriver ? '' : ''} />
                    <div className="grid2">
                      <Field label="LICENCIA" value="" />
                      <Field label="NUM. DE CONTACTO" value="" />
                    </div>

                    {/* Conductor adicional 2 */}
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>CONDUCTOR ADICIONAL:</div>
                    <div className="grid2">
                      <Field label="LICENCIA" value="" />
                      <Field label="NUM. DE CONTACTO" value="" />
                    </div>

                    <Field label="DIRECCIÓN LOCAL" value="" />

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
                          <div style={{ minHeight: 12 }} />
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>NUM. DE APROB.</div>
                          <div style={{ minHeight: 12 }} />
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>PREPARADO POR:</div>
                          <div style={{ minHeight: 12 }} />
                        </td>
                        <td style={{ border: '0.7px solid #000', padding: '2px 4px', fontSize: 8, width: '25%' }}>
                          <div style={{ fontSize: 7, fontWeight: 700 }}>FORMA DE PAGO:</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 7, display:'flex', gap:2, alignItems:'center' }}><span className="box" style={{ width:8, height:8 }}/> EFECTIVO</span>
                            <span style={{ fontSize: 7, display:'flex', gap:2, alignItems:'center' }}><span className="box" style={{ width:8, height:8 }}/> TARJETA</span>
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
                      <Field label="EDAD DEL CONDUCTOR" value="" />
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
                        <span className="box"/><span>CLIENTE TIENE MASCOTAS / PETS:</span>
                      </div>
                    </div>

                    {/* Tabla de seguros */}
                    <div style={{ marginTop: 3 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.7px solid #000' }}>
                        <tbody>
                          <InsuranceRow label="SEGURO DE COLISIÓN — CDW:" />
                          <InsuranceRow label="SEG. DAÑOS A TERCEROS — LIABILITY:" />
                          <InsuranceRow label="SEG. GOMAS Y CRISTALES — TIRES AND WINDSHIELD:" />
                          <InsuranceRow label="SEG. ANTI-ROBOS — ANTI-THEFT:" />
                          <InsuranceRow label="PAQUETE DE SEGUROS CDW / LIA / TW / AT:" />
                          <tr>
                            <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '45%' }}>SEGURO BÁSICO — LIA / TW:</td>
                            <td style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc', width: '18%' }}>PRECIO:</td>
                            <td colSpan={2} style={{ fontSize: 8, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}>DEDUCIBLE:</td>
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
                        {[
                          'TASA DE CAMBIO: USD - RD',
                          'DEPÓSITO',
                          'SUB-TOTAL',
                          'IMPUESTOS: ITBIS (   )',
                          'IMPUESTOS: AIRPORT (   )',
                          'DESCUENTOS',
                        ].map((item, i) => (
                          <tr key={`t${i}`}>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', width: '65%', fontWeight: item.includes('TOTAL') || item.includes('DESCUENTO') ? 700 : 400 }}>{item}</td>
                            <td style={{ fontSize: 7.5, padding: '1px 3px', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}/>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ fontSize: 8, padding: '2px 3px', fontWeight: 700 }}>TOTAL EN DÓLARES (USD):</td>
                          <td style={{ fontSize: 8, padding: '2px 3px', borderLeft: '0.5px solid #ccc', fontWeight: 700 }}/>
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

      </div>
    </>
  )
}
