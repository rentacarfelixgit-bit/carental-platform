// src/lib/contractTerms.ts
// Términos y condiciones del contrato (Configuración → Términos y condiciones).
// Mientras el cliente no entregue los términos reales se usa un texto PROVISIONAL.
// "Reglas adicionales": modificaciones o reglas nuevas que el negocio agregue con el tiempo;
// se imprimen numeradas debajo de los términos, con la fecha en que se agregaron.

export interface ContractRule { id: string; text: string; added_at: string }
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

export function getContractTerms(settings: unknown): ContractTerms {
  const s = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).contract_terms : null
  const o = (s && typeof s === 'object' ? s : {}) as Partial<ContractTerms>
  const text = typeof o.text === 'string' ? o.text.trim().slice(0, 30000) : ''
  const rules = (Array.isArray(o.rules) ? o.rules : [])
    .filter((r): r is ContractRule => !!r && typeof r.id === 'string' && typeof r.text === 'string' && r.text.trim() !== '')
    .map(r => ({ id: r.id.slice(0, 40), text: r.text.trim().slice(0, 2000), added_at: typeof r.added_at === 'string' ? r.added_at.slice(0, 10) : '' }))
    .slice(0, MAX_RULES)
  return { text: text || PROVISIONAL_TERMS, rules, provisional: !text }
}
