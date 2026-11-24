'use client'

// src/app/dashboard/configuracion/TermsForm.tsx
// Términos y condiciones que se imprimen con cada contrato, y reglas adicionales que se van
// agregando con el tiempo (cada una con su fecha de vigencia). Se capturan en ESPAÑOL e INGLÉS:
// el contrato imprime el idioma elegido en "Preparar contrato". Mientras un idioma esté vacío,
// se imprimen los términos PROVISIONALES de ese idioma.

import { useState, useTransition } from 'react'
import { saveContractTerms } from './actions'
import {
  PROVISIONAL_TERMS, PROVISIONAL_TERMS_EN, MAX_RULES,
  type ContractTermsBi, type ContractRuleBi, type TermsLang,
} from '@/lib/contractTerms'

const LANGS: { value: TermsLang; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

export default function TermsForm({ terms, canEdit }: { terms: ContractTermsBi; canEdit: boolean }) {
  const [lang, setLang] = useState<TermsLang>('es')
  const [text, setText] = useState(terms.text)
  const [textEn, setTextEn] = useState(terms.text_en)
  const [rules, setRules] = useState<ContractRuleBi[]>(terms.rules)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const disabled = !canEdit || pending
  const touch = () => { setSaved(false); setError('') }
  const today = new Date().toISOString().slice(0, 10)

  const isEn = lang === 'en'
  const curText = isEn ? textEn : text
  const setCurText = isEn ? setTextEn : setText
  const provisional = isEn ? PROVISIONAL_TERMS_EN : PROVISIONAL_TERMS
  const ruleKey = isEn ? 'text_en' : 'text'
  // Aviso en cada pestaña si al otro idioma le falta algo
  const missing = (l: TermsLang) => {
    const t = l === 'en' ? textEn : text
    return !t.trim() || rules.some(r => !(l === 'en' ? r.text_en : r.text).trim())
  }

  function save() {
    startTransition(async () => {
      const res = await saveContractTerms({ text, text_en: textEn, rules })
      if (res.error) setError(res.error); else setSaved(true)
    })
  }

  return (
    <div className="space-y-5">
      {/* Pestañas de idioma */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5" role="tablist" aria-label="Idioma de los términos">
          {LANGS.map(l => (
            <button key={l.value} type="button" role="tab" aria-selected={lang === l.value}
              onClick={() => setLang(l.value)}
              className={`relative px-4 py-1.5 text-sm rounded-md transition-colors ${lang === l.value ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {l.label}
              {missing(l.value) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white" title="Falta texto en este idioma" />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          El contrato imprime los términos en el idioma que se elija en &ldquo;Preparar contrato&rdquo;.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-900">
            Texto de los términos y condiciones {isEn ? '(English)' : '(Español)'}
          </h3>
          {!curText.trim() && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Se imprimen los términos provisionales {isEn ? 'en inglés' : 'en español'}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {isEn
            ? 'Escribe aquí los términos en inglés. Se imprimen cuando el contrato se genera en English.'
            : 'Pega aquí los términos reales cuando los tengas. Se imprimen cuando el contrato se genera en Español.'}
          {' '}Mientras esté vacío, el contrato imprime un texto provisional marcado como tal.
        </p>
        <textarea key={lang} value={curText} onChange={e => { setCurText(e.target.value); touch() }} disabled={disabled} rows={12}
          placeholder={provisional} lang={lang}
          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 disabled:bg-gray-50 font-mono" />
        {canEdit && !curText.trim() && (
          <button type="button" onClick={() => { setCurText(provisional); touch() }}
            className="text-[13px] text-blue-600 hover:text-blue-700 font-medium">
            Usar el texto provisional como base para editarlo
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">
            Modificaciones y reglas adicionales {isEn ? '(English)' : '(Español)'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Reglas nuevas que se agregan con el tiempo. Se imprimen numeradas debajo de los términos, con la fecha desde la que aplican.
            Cada regla tiene su texto en español y en inglés (cambia de pestaña para escribir la traducción); si falta la traducción,
            se imprime en el otro idioma. Además, cada contrato impreso trae renglones en blanco para anotar modificaciones acordadas con ese cliente.
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {rules.map((r, i) => {
            const other = isEn ? r.text : r.text_en
            return (
              <div key={r.id} className="px-4 py-3 flex gap-2 items-start">
                <span className="text-xs text-gray-400 w-5 pt-2">{i + 1}.</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <textarea value={r[ruleKey]} rows={2} maxLength={2000} disabled={disabled} lang={lang}
                    onChange={e => { setRules(rules.map(x => x.id === r.id ? { ...x, [ruleKey]: e.target.value } : x)); touch() }}
                    placeholder={isEn
                      ? (other ? `Traducción de: ${other}` : 'E.g. Vehicles may not leave the province without authorization.')
                      : (other ? `Traducción de: ${other}` : 'Ej. Los vehículos no pueden salir de la provincia sin autorización.')}
                    className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                  {!r[ruleKey].trim() && other.trim() && (
                    <p className="text-xs text-amber-700">
                      Sin traducción: en {isEn ? 'English' : 'Español'} se imprimirá el texto {isEn ? 'en español' : 'en inglés'}.
                    </p>
                  )}
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
            )
          })}
          {rules.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">Aún no hay reglas adicionales.</p>}
        </div>
        {canEdit && rules.length < MAX_RULES && (
          <div className="px-4 py-2.5 border-t border-gray-100">
            <button type="button" disabled={pending}
              onClick={() => { setRules([...rules, { id: `r_${Date.now().toString(36)}`, text: '', text_en: '', added_at: today }]); touch() }}
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
          <span className="text-xs text-gray-500">Guarda los dos idiomas a la vez.</span>
          {saved && <span className="text-sm text-green-600">Guardado correctamente</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Solo un administrador puede modificar los términos.</p>
      )}
    </div>
  )
}
