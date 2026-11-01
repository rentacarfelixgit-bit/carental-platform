'use client'

// src/app/dashboard/configuracion/TermsForm.tsx
// Términos y condiciones que se imprimen con cada contrato, y reglas adicionales que se van
// agregando con el tiempo (cada una con su fecha de vigencia). Mientras no se capture el texto
// real, el contrato imprime los términos PROVISIONALES.

import { useState, useTransition } from 'react'
import { saveContractTerms } from './actions'
import { PROVISIONAL_TERMS, MAX_RULES, type ContractTerms, type ContractRule } from '@/lib/contractTerms'

export default function TermsForm({ terms, canEdit }: { terms: ContractTerms; canEdit: boolean }) {
  const [text, setText] = useState(terms.provisional ? '' : terms.text)
  const [rules, setRules] = useState<ContractRule[]>(terms.rules)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const disabled = !canEdit || pending
  const touch = () => { setSaved(false); setError('') }
  const today = new Date().toISOString().slice(0, 10)

  function save() {
    startTransition(async () => {
      const res = await saveContractTerms({ text, rules })
      if (res.error) setError(res.error); else setSaved(true)
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-900">Texto de los términos y condiciones</h3>
          {!text.trim() && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Se imprimen los términos provisionales
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Pega aquí los términos reales cuando los tengas. Mientras esté vacío, el contrato imprime un texto provisional marcado como tal.
        </p>
        <textarea value={text} onChange={e => { setText(e.target.value); touch() }} disabled={disabled} rows={12}
          placeholder={PROVISIONAL_TERMS}
          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:bg-gray-50 font-mono" />
        {canEdit && !text.trim() && (
          <button type="button" onClick={() => { setText(PROVISIONAL_TERMS); touch() }}
            className="text-[13px] text-blue-600 hover:text-blue-700 font-medium">
            Usar el texto provisional como base para editarlo
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">Modificaciones y reglas adicionales</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Reglas nuevas que se agregan con el tiempo. Se imprimen numeradas debajo de los términos, con la fecha desde la que aplican.
            Además, cada contrato impreso trae renglones en blanco para anotar modificaciones acordadas con ese cliente.
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {rules.map((r, i) => (
            <div key={r.id} className="px-4 py-3 flex gap-2 items-start">
              <span className="text-xs text-gray-400 w-5 pt-2">{i + 1}.</span>
              <div className="flex-1 min-w-0 space-y-1">
                <textarea value={r.text} rows={2} maxLength={2000} disabled={disabled}
                  onChange={e => { setRules(rules.map(x => x.id === r.id ? { ...x, text: e.target.value } : x)); touch() }}
                  placeholder="Ej. Los vehículos no pueden salir de la provincia sin autorización."
                  className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Vigente desde
                  <input type="date" value={r.added_at} disabled={disabled}
                    onChange={e => { setRules(rules.map(x => x.id === r.id ? { ...x, added_at: e.target.value } : x)); touch() }}
                    className="px-2 py-1 text-xs text-gray-900 border border-gray-300 rounded" />
                </label>
              </div>
              {canEdit && (
                <button type="button" onClick={() => { setRules(rules.filter(x => x.id !== r.id)); touch() }} disabled={pending}
                  className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50">Quitar</button>
              )}
            </div>
          ))}
          {rules.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Aún no hay reglas adicionales.</p>}
        </div>
        {canEdit && rules.length < MAX_RULES && (
          <div className="px-4 py-2.5 border-t border-gray-100">
            <button type="button" disabled={pending}
              onClick={() => { setRules([...rules, { id: `r_${Date.now().toString(36)}`, text: '', added_at: today }]); touch() }}
              className="text-[14px] text-blue-600 hover:text-blue-700 font-medium">+ Agregar regla</button>
          </div>
        )}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending}
            className="px-4 py-2 text-[14px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {pending ? 'Guardando...' : 'Guardar términos'}
          </button>
          {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Solo un administrador puede modificar los términos.</p>
      )}
    </div>
  )
}
