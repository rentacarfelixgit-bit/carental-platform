// src/app/print/reservas/[id]/contrato/ExtraPages.tsx
// Hojas que se imprimen junto al contrato:
//  - Carta de declinación de seguros (si el cliente declinó todos)   → formato PROVISIONAL
//  - Carta oficial del seguro de tarjeta (Amex / Visa / Mastercard)  → imagen de public/docs
//  - Términos y condiciones + reglas adicionales y espacio para nuevas modificaciones

import type { ContractTerms, TermsLang } from '@/lib/contractTerms'

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

const provisionalBadgeText = (text: string) => (
  <div style={{ border: '1px dashed #999', color: '#666', fontSize: 7.5, padding: '2px 6px', textAlign: 'center', margin: '4px 0 8px' }}>
    {text}
  </div>
)
const provisionalBadge = provisionalBadgeText('FORMATO PROVISIONAL — SE SUSTITUIRÁ POR EL DOCUMENTO OFICIAL')

/** Textos fijos de la hoja de términos en cada idioma */
const TERMS_TXT: Record<TermsLang, {
  title: (n: string) => string; provisional: string; rulesHdr: string; since: (d: string) => string
  otherMods: string; sigClient: string; sigCompany: string; locale: string
}> = {
  es: {
    title: n => `Términos y condiciones · Contrato No. ${n}`,
    provisional: 'FORMATO PROVISIONAL — SE SUSTITUIRÁ POR EL DOCUMENTO OFICIAL',
    rulesHdr: 'Modificaciones y reglas adicionales',
    since: d => `(vigente desde ${d})`,
    otherMods: 'Otras modificaciones acordadas para este contrato:',
    sigClient: 'FIRMA DEL CLIENTE (ACEPTO) / CLIENT SIGNATURE',
    sigCompany: 'FIRMA DE LA ARRENDADORA',
    locale: 'es-DO',
  },
  en: {
    title: n => `Terms and conditions · Agreement No. ${n}`,
    provisional: 'PROVISIONAL FORMAT — WILL BE REPLACED BY THE OFFICIAL DOCUMENT',
    rulesHdr: 'Amendments and additional rules',
    since: d => `(effective ${d})`,
    otherMods: 'Other amendments agreed for this agreement:',
    sigClient: 'CUSTOMER SIGNATURE (I ACCEPT)',
    sigCompany: 'RENTAL COMPANY SIGNATURE',
    locale: 'en-US',
  },
}

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

/** Carta oficial del seguro de tarjeta (Amex / Visa / Mastercard).
 *  Imágenes generadas de public/docs/Decline Lette {Amex|Visa|MasterCard}.pdf */
const CARD_LETTER_IMG: Record<'amex' | 'visa' | 'mastercard', string> = {
  amex: '/docs/decline-letter-amex.png',
  visa: '/docs/decline-letter-visa.png',
  mastercard: '/docs/decline-letter-mastercard.png',
}

export function CardDeclineLetter({ card, cardName }: { card: 'amex' | 'visa' | 'mastercard'; cardName: string }) {
  return (
    <div className="page page-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={CARD_LETTER_IMG[card]} alt={`Carta de declinación de seguros — ${cardName}`} />
    </div>
  )
}

/** Términos y condiciones + reglas adicionales + espacio para nuevas modificaciones */
export function TermsPage(p: Common & { terms: ContractTerms; lang?: TermsLang }) {
  const tx = TERMS_TXT[p.lang ?? 'es']
  const fmtDate = (d: string) => d ? new Date(`${d}T12:00:00`).toLocaleDateString(tx.locale) : ''
  return (
    <div className="page" lang={p.lang ?? 'es'}>
      <div className="co-title">{p.companyName}</div>
      <div className="co-sub">{tx.title(p.contratoNum)}</div>
      {p.terms.provisional && provisionalBadgeText(tx.provisional)}
      <div style={{ fontSize: 8, lineHeight: 1.45, whiteSpace: 'pre-line', textAlign: 'justify' }}>{p.terms.text}</div>

      <div className="section-hdr" style={{ marginTop: 10 }}>{tx.rulesHdr}</div>
      {p.terms.rules.length > 0 && (
        <ol style={{ fontSize: 8, lineHeight: 1.45, margin: '2px 0 6px 16px' }}>
          {p.terms.rules.map(r => (
            <li key={r.id} style={{ marginBottom: 2 }}>
              {r.text}{r.added_at && <span style={{ color: '#555' }}> {tx.since(fmtDate(r.added_at))}</span>}
            </li>
          ))}
        </ol>
      )}
      {/* Espacio para anotar modificaciones a mano */}
      <div style={{ fontSize: 7.5, color: '#333', margin: '4px 0 2px' }}>{tx.otherMods}</div>
      {[0, 1, 2, 3].map(i => <div key={i} style={{ borderBottom: '0.7px solid #000', height: 14 }} />)}

      {sigBox([tx.sigClient, tx.sigCompany])}
    </div>
  )
}
