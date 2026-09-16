'use client'

// src/app/dashboard/clientes/[id]/editar/BlacklistSection.tsx

import { useActionState, useTransition } from 'react'
import { addToBlacklist, removeFromBlacklist } from '../../actions'

interface BlacklistEntry {
  id: string
  reason: string
  added_at: string
}

interface Props {
  clientId: string
  isAdmin: boolean
  activeEntry: BlacklistEntry | null
}

export default function BlacklistSection({ clientId, isAdmin, activeEntry }: Props) {
  const boundAdd  = addToBlacklist.bind(null, clientId)
  const [addState, addAction, addPending] = useActionState(boundAdd, {})
  const [removePending, startRemove] = useTransition()

  function handleRemove() {
    if (!activeEntry) return
    if (!confirm('¿Retirar a este cliente de la lista negra?')) return
    startRemove(async () => {
      await removeFromBlacklist(activeEntry.id, clientId)
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-6 pb-6">
      <div className="border-t border-gray-100 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium text-gray-700">Lista negra</h3>
          {activeEntry && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
              En lista negra
            </span>
          )}
        </div>

        {activeEntry ? (
          // Cliente en lista negra — mostrar info y botón para retirar
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <div>
              <p className="text-xs text-red-500 mb-0.5">Motivo</p>
              <p className="text-sm text-red-800">{activeEntry.reason}</p>
              <p className="text-xs text-red-400 mt-1">
                Agregado el {new Date(activeEntry.added_at).toLocaleDateString('es-MX')}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={handleRemove}
                disabled={removePending}
                className="text-sm px-4 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {removePending ? 'Retirando...' : 'Retirar de lista negra'}
              </button>
            )}
          </div>
        ) : (
          // Cliente limpio — admins pueden agregar
          isAdmin ? (
            <form action={addAction} className="space-y-3">
              {addState.error && (
                <p className="text-xs text-red-600">{addState.error}</p>
              )}
              {addState.success && (
                <p className="text-xs text-green-600">Cliente agregado a la lista negra.</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motivo para agregar a lista negra
                </label>
                <textarea
                  name="reason"
                  rows={2}
                  disabled={addPending}
                  placeholder="Describe el motivo..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none placeholder:text-gray-400 disabled:opacity-50"
                />
                {addState.fieldErrors?.reason && (
                  <p className="mt-1 text-xs text-red-600">{addState.fieldErrors.reason[0]}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={addPending}
                className="text-sm px-4 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {addPending ? 'Agregando...' : 'Agregar a lista negra'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-400">Este cliente no está en la lista negra.</p>
          )
        )}
      </div>
    </div>
  )
}
