'use client'

// src/components/dashboard/rental/InsuranceWaiver.tsx
// "Declinar todos los seguros" y "Seguro de tarjeta" (Amex / Visa / Mastercard).
// - Declinar todos: ningún seguro queda aceptado y se imprime la carta de declinación.
// - Seguro de tarjeta: se declinan todos menos Gomas y cristales y Liability; se imprime el
//   documento de la tarjeta elegida.
// Se usan en Nueva reserva / Nuevo contrato y en "Preparar contrato".

import {
  CARD_INSURANCES, CARD_INSURANCE_KEEPS, insuranceLocked,
  type CardInsurance, type PriceItem,
} from '@/lib/reservationPrices'

export function InsuranceWaiverControls({ waiveAll, onWaiveAll, card, onCard, disabled, compact = false }: {
  waiveAll: boolean
  onWaiveAll: (v: boolean) => void
  card: CardInsurance | null
  onCard: (v: CardInsurance | null) => void
  disabled?: boolean
  compact?: boolean
}) {
  const txt = compact ? 'text-xs' : 'text-sm'
  return (
    <div className={`space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 ${txt}`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={waiveAll} disabled={disabled}
          onChange={e => { onWaiveAll(e.target.checked); if (e.target.checked) onCard(null) }}
          className="rounded accent-red-600 flex-shrink-0" />
        <span className="font-medium text-gray-800">Declinar todos los seguros</span>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-gray-700 whitespace-nowrap">Seguro de tarjeta</span>
        <select value={card ?? ''} disabled={disabled || waiveAll}
          onChange={e => onCard((e.target.value || null) as CardInsurance | null)}
          className="flex-1 min-w-0 px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50">
          <option value="">— Ninguno —</option>
          {(Object.keys(CARD_INSURANCES) as CardInsurance[]).map(k => <option key={k} value={k}>{CARD_INSURANCES[k]}</option>)}
        </select>
      </div>
      {card && (
        <p className="text-[11px] text-amber-800">
          Con el seguro de {CARD_INSURANCES[card]} se declinan los demás seguros; solo se pueden aceptar
          Gomas y cristales y Liability. Se imprimirá el documento de la tarjeta.
        </p>
      )}
      {waiveAll && <p className="text-[11px] text-red-700">Se imprimirá la carta de declinación de seguros para firma del cliente.</p>}
    </div>
  )
}

/** Nombres de los seguros que quedan declinados */
export function declinedInsurances(items: PriceItem[], checked: Record<string, boolean>, waiveAll: boolean, card: CardInsurance | null) {
  return items.filter(i => !checked[i.key] || insuranceLocked(i.key, waiveAll, card))
}

export function DeclinedInsurancesList({ items, compact = false }: { items: PriceItem[]; compact?: boolean }) {
  if (!items.length) return null
  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 p-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      <p className="font-semibold text-gray-800 mb-1">Seguros declinados:</p>
      <ul className="list-disc pl-4 space-y-0.5 text-gray-700">
        {items.map(i => <li key={i.key}>{i.label}</li>)}
      </ul>
    </div>
  )
}

export { CARD_INSURANCE_KEEPS }
