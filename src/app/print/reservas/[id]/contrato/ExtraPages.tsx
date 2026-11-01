// src/app/print/reservas/[id]/contrato/ExtraPages.tsx
// Hojas que se imprimen junto al contrato:
//  - Carta de declinación de seguros (si el cliente declinó todos)   → formato PROVISIONAL
//  - Documento del seguro de tarjeta (Amex / Visa / Mastercard)      → formato PROVISIONAL
//  - Términos y condiciones + reglas adicionales y espacio para nuevas modificaciones

import type { ContractTerms } from '@/lib/contractTerms'

interface Common {
  companyName: string
  contratoNum: string
  clientName: string
  clientDoc: string
  vehicleText: string
  periodText: string
  todayText: string
}

const sigBox = (labels: string[]) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18 }}>
    <tbody>
      <tr>
        {labels.map(l => (
          <td key={l} style={{ border: '0.7px solid #000', padding: '3px 5px', width: `${100 / labels.length}%`, verticalAlign: 'bottom' }}>
            <div style={{ minHeight: 34, borderBottom: '0.7px solid #000', marginBottom: 2 }} />
            <div className="sig-label">{l}</div>
          </td>
        ))}
      </tr>
    </tbody>
  </table>
)

const provisionalBadge = (
  <div style={{ border: '1px dashed #999', color: '#666', fontSize: 7.5, padding: '2px 6px', textAlign: 'center', margin: '4px 0 8px' }}>
    FORMATO PROVISIONAL — SE SUSTITUIRÁ POR EL DOCUMENTO OFICIAL
  </div>
)

function DataTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0' }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ border: '0.7px solid #000', padding: '2px 5px', fontSize: 8, fontWeight: 700, width: '32%' }}>{k}</td>
            <td style={{ border: '0.7px solid #000', padding: '2px 5px', fontSize: 9 }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Carta de declinación de seguros */
export function WaiverLetter(p: Common & { declined: string[] }) {
  return (
    <div className="page">
      <div className="co-title">{p.companyName}</div>
      <div className="co-sub">Carta de declinación de seguros / Insurance waiver</div>
      {provisionalBadge}
      <DataTable rows={[
        ['CONTRATO No.', p.contratoNum], ['CLIENTE', p.clientName], ['LICENCIA / PASAPORTE', p.clientDoc],
        ['VEHÍCULO', p.vehicleText], ['PERÍODO', p.periodText],
      ]} />
      <div style={{ fontSize: 9, lineHeight: 1.5, marginTop: 8 }}>
        <p>Yo, <b>{p.clientName}</b>, declaro que se me ofrecieron los seguros de la arrendadora y que, de forma libre y voluntaria,
          <b> DECLINO</b> los siguientes:</p>
        <p style={{ fontWeight: 700, margin: '6px 0 2px' }}>SEGUROS DECLINADOS:</p>
        <ul style={{ margin: '0 0 6px 18px' }}>
          {p.declined.map(d => <li key={d}>{d.toUpperCase()}</li>)}
        </ul>
        <p>Entiendo y acepto que, al declinarlos, asumo la responsabilidad total por cualquier daño, pérdida, robo o situación que
          presente el vehículo durante el período de renta, incluidos daños a terceros, y autorizo a la arrendadora a cobrar dichos
          montos a mi tarjeta o depósito.</p>
        <p style={{ marginTop: 6, fontSize: 8, color: '#333' }}>
          <i>I declare that the rental company offered me its insurance coverages and I voluntarily decline the coverages listed above.
            I accept full responsibility for any damage, loss or theft of the vehicle during the rental period, including third-party damages,
            and authorize the charge of such amounts to my card or deposit.</i>
        </p>
      </div>
      <p style={{ fontSize: 8.5, marginTop: 10 }}>Fecha: {p.todayText}</p>
      {sigBox(['FIRMA DEL CLIENTE / CLIENT SIGNATURE', 'FIRMA DE LA ARRENDADORA'])}
    </div>
  )
}

/** Documento del seguro de tarjeta (Amex / Visa / Mastercard) */
export function CardInsuranceDoc(p: Common & { cardName: string; keeps: string[] }) {
  return (
    <div className="page">
      <div className="co-title">{p.companyName}</div>
      <div className="co-sub">Cobertura de seguro de tarjeta — {p.cardName}</div>
      {provisionalBadge}
      <DataTable rows={[
        ['CONTRATO No.', p.contratoNum], ['CLIENTE', p.clientName], ['LICENCIA / PASAPORTE', p.clientDoc],
        ['VEHÍCULO', p.vehicleText], ['PERÍODO', p.periodText], ['TARJETA', `${p.cardName}  ·  Últimos 4 dígitos: ________`],
      ]} />
      <div style={{ fontSize: 9, lineHeight: 1.5, marginTop: 8 }}>
        <p>El cliente declara que su tarjeta <b>{p.cardName}</b> le brinda cobertura para la renta de vehículos y que utilizará esa
          cobertura en lugar de los seguros de la arrendadora, por lo que <b>declina los seguros de la arrendadora</b>, excepto:</p>
        <ul style={{ margin: '4px 0 6px 18px' }}>
          {p.keeps.map(k => <li key={k}>{k.toUpperCase()}</li>)}
        </ul>
        <p>El cliente es responsable de presentar a su emisor de tarjeta las reclamaciones que correspondan y de pagar a la arrendadora
          los daños o pérdidas mientras el emisor resuelve. Aquí se imprimirá el documento oficial de {p.cardName} cuando el negocio lo proporcione.</p>
      </div>
      <p style={{ fontSize: 8.5, marginTop: 10 }}>Fecha: {p.todayText}</p>
      {sigBox(['FIRMA DEL CLIENTE / CLIENT SIGNATURE', 'FIRMA DE LA ARRENDADORA'])}
    </div>
  )
}

/** Términos y condiciones + reglas adicionales + espacio para nuevas modificaciones */
export function TermsPage(p: Common & { terms: ContractTerms }) {
  const fmtDate = (d: string) => d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-DO') : ''
  return (
    <div className="page">
      <div className="co-title">{p.companyName}</div>
      <div className="co-sub">Términos y condiciones · Contrato No. {p.contratoNum}</div>
      {p.terms.provisional && provisionalBadge}
      <div style={{ fontSize: 8, lineHeight: 1.45, whiteSpace: 'pre-line', textAlign: 'justify' }}>{p.terms.text}</div>

      <div className="section-hdr" style={{ marginTop: 10 }}>Modificaciones y reglas adicionales</div>
      {p.terms.rules.length > 0 && (
        <ol style={{ fontSize: 8, lineHeight: 1.45, margin: '2px 0 6px 16px' }}>
          {p.terms.rules.map(r => (
            <li key={r.id} style={{ marginBottom: 2 }}>
              {r.text}{r.added_at && <span style={{ color: '#555' }}> (vigente desde {fmtDate(r.added_at)})</span>}
            </li>
          ))}
        </ol>
      )}
      {/* Espacio para anotar modificaciones a mano */}
      <div style={{ fontSize: 7.5, color: '#333', margin: '4px 0 2px' }}>Otras modificaciones acordadas para este contrato:</div>
      {[0, 1, 2, 3].map(i => <div key={i} style={{ borderBottom: '0.7px solid #000', height: 14 }} />)}

      {sigBox(['FIRMA DEL CLIENTE (ACEPTO) / CLIENT SIGNATURE', 'FIRMA DE LA ARRENDADORA'])}
    </div>
  )
}
