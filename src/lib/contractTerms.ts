// src/lib/contractTerms.ts
// Términos y condiciones del contrato (Configuración → Términos y condiciones).
// Mientras el cliente no entregue los términos reales se usa un texto PROVISIONAL.
// "Reglas adicionales": modificaciones o reglas nuevas que el negocio agregue con el tiempo;
// se imprimen numeradas debajo de los términos, con la fecha en que se agregaron.
// Bilingüe: se guarda el texto en español (text) y en inglés (text_en); cada regla también
// tiene su traducción (text_en). Se imprime el idioma elegido en "Preparar contrato".

export type TermsLang = 'es' | 'en'

/** Regla tal como se imprime (un solo idioma) */
export interface ContractRule { id: string; text: string; added_at: string }
/** Regla tal como se guarda / edita (los dos idiomas) */
export interface ContractRuleBi { id: string; text: string; text_en: string; added_at: string }
/** Términos tal como se guardan / editan en Configuración */
export interface ContractTermsBi { text: string; text_en: string; rules: ContractRuleBi[] }

/** Términos ya resueltos para imprimir en un idioma */
export interface ContractTerms {
  /** Texto principal. Vacío = usar el provisional */
  text: string
  rules: ContractRule[]
  /** true mientras se usan los términos provisionales */
  provisional: boolean
}

export const MAX_RULES = 50

export const PROVISIONAL_TERMS = `1. OBJETO. La arrendadora entrega al arrendatario el vehículo descrito en este contrato, en buen estado de funcionamiento, para su uso personal dentro del territorio de la República Dominicana durante el período pactado.

2. CONDUCTORES. Solo podrán conducir el vehículo el arrendatario y los conductores adicionales registrados en este contrato, con licencia de conducir vigente y la edad mínima establecida por la arrendadora.

3. DURACIÓN Y DEVOLUCIÓN. La renta se calcula en períodos de 24 horas desde la entrega. El vehículo debe devolverse en la fecha, hora y lugar acordados. Pasadas 4 horas del período se cobrará un día adicional.

4. COMBUSTIBLE Y LIMPIEZA. El vehículo debe devolverse con el mismo nivel de combustible y en condiciones de limpieza similares a las de la entrega; de lo contrario se cobrarán los cargos correspondientes.

5. SEGUROS Y DAÑOS. El arrendatario puede aceptar o declinar los seguros ofrecidos. Si los declina, será responsable de los daños, pérdidas o robo del vehículo durante la renta, hasta su valor total, y de los deducibles que apliquen en caso de aceptarlos.

6. USO PROHIBIDO. Queda prohibido usar el vehículo para fines ilícitos, carreras, remolque, transporte de carga no autorizada, subarrendarlo o conducirlo bajo los efectos del alcohol o drogas.

7. ACCIDENTES Y ROBO. En caso de accidente, robo o daño, el arrendatario debe avisar de inmediato a la arrendadora y obtener el acta policial correspondiente.

8. MULTAS Y PEAJES. Las multas, peajes y sanciones generadas durante la renta corren por cuenta del arrendatario.

9. PAGOS Y DEPÓSITO. El arrendatario autoriza el cargo a su tarjeta o depósito de los montos de este contrato y de los cargos adicionales documentados al cierre (días extra, combustible, limpieza, daños, equipo no devuelto).

10. ACEPTACIÓN. Con su firma el arrendatario declara haber leído y aceptado estos términos y condiciones.`

export const PROVISIONAL_TERMS_EN = `1. PURPOSE. The rental company delivers to the renter the vehicle described in this agreement, in good working condition, for personal use within the territory of the Dominican Republic during the agreed period.

2. DRIVERS. Only the renter and the additional drivers registered in this agreement may drive the vehicle, with a valid driver's license and the minimum age set by the rental company.

3. DURATION AND RETURN. The rental is calculated in 24-hour periods from delivery. The vehicle must be returned on the agreed date, time and place. After 4 hours past the period, an additional day will be charged.

4. FUEL AND CLEANLINESS. The vehicle must be returned with the same fuel level and in a condition of cleanliness similar to that at delivery; otherwise the corresponding charges will apply.

5. INSURANCE AND DAMAGES. The renter may accept or decline the insurance offered. If declined, the renter will be responsible for damage, loss or theft of the vehicle during the rental, up to its full value, and for any deductibles that apply if accepted.

6. PROHIBITED USE. The vehicle may not be used for illegal purposes, racing, towing, unauthorized cargo transport, subleasing, or driving under the influence of alcohol or drugs.

7. ACCIDENTS AND THEFT. In case of accident, theft or damage, the renter must immediately notify the rental company and obtain the corresponding police report.

8. FINES AND TOLLS. Fines, tolls and penalties incurred during the rental are the renter's responsibility.

9. PAYMENTS AND DEPOSIT. The renter authorizes charging to their card or deposit the amounts of this agreement and the additional charges documented at closing (extra days, fuel, cleaning, damages, unreturned equipment).

10. ACCEPTANCE. By signing, the renter declares to have read and accepted these terms and conditions.`

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Lo guardado en Configuración, con los dos idiomas (para el formulario de edición) */
export function getContractTermsBi(settings: unknown): ContractTermsBi {
  const s = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).contract_terms : null
  const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
  const rules = (Array.isArray(o.rules) ? o.rules : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as Record<string, unknown>).id === 'string')
    .map(r => ({
      id: String(r.id).slice(0, 40),
      text: clean(r.text, 2000),
      text_en: clean(r.text_en, 2000),
      added_at: typeof r.added_at === 'string' ? r.added_at.slice(0, 10) : '',
    }))
    .filter(r => r.text !== '' || r.text_en !== '')
    .slice(0, MAX_RULES)
  return { text: clean(o.text, 30000), text_en: clean(o.text_en, 30000), rules }
}

/** Términos listos para imprimir en el idioma pedido.
 *  - Texto vacío en ese idioma → texto PROVISIONAL de ese idioma.
 *  - Regla sin traducción → se imprime en el otro idioma para no perderla. */
export function getContractTerms(settings: unknown, lang: TermsLang = 'es'): ContractTerms {
  const bi = getContractTermsBi(settings)
  const text = lang === 'en' ? bi.text_en : bi.text
  const rules = bi.rules.map(r => ({
    id: r.id,
    text: (lang === 'en' ? r.text_en || r.text : r.text || r.text_en),
    added_at: r.added_at,
  }))
  return {
    text: text || (lang === 'en' ? PROVISIONAL_TERMS_EN : PROVISIONAL_TERMS),
    rules,
    provisional: !text,
  }
}
