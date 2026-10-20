'use client'

// src/app/dashboard/usuarios/UsuariosTable.tsx
// Tabla de usuarios. El orden y la paginación los hace el servidor (URL); aquí van las acciones:
// cambiar contraseña, activar/desactivar y eliminar (con confirmación).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ToggleActiveButton from './ToggleActiveButton'
import ChangePasswordModal from './ChangePasswordModal'
import { deleteUser } from './actions'
import { SortLinkTh } from '@/components/dashboard/SortableTh'
import { applySortParams, type SortState } from '@/lib/tableSort'

const roleLabels: Record<string, { label: string; className: string }> = {
  superadmin: { label: 'Superadmin', className: 'bg-purple-100 text-purple-700' },
  admin:      { label: 'Admin',      className: 'bg-blue-100 text-blue-700' },
  operator:   { label: 'Operador',   className: 'bg-gray-100 text-gray-700' },
}

interface User {
  id: string
  full_name: string
  email: string
  role: string
  active: boolean
  created_at: string
}

interface Props {
  usuarios: User[]
  currentUserId: string
  sort: SortState | null
  /** Parámetros de la búsqueda actual (para conservarlos al ordenar), p. ej. "q=ana" */
  sortBaseQuery: string
  canDelete: boolean
}

export default function UsuariosTable({ usuarios, currentUserId, sort, sortBaseQuery, canDelete }: Props) {
  const router = useRouter()
  const [pwdModal, setPwdModal] = useState<{ id: string; name: string } | null>(null)
  const [toDelete, setToDelete] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()

  const sortHref = (next: SortState | null) => {
    const params = applySortParams(new URLSearchParams(sortBaseQuery), next)
    const s = params.toString()
    return `/dashboard/usuarios${s ? `?${s}` : ''}`
  }

  function confirmDelete() {
    if (!toDelete) return
    setDeleteError('')
    const name = toDelete.full_name
    startTransition(async () => {
      const res = await deleteUser(toDelete.id)
      if (res.error) { setDeleteError(res.error); return }
      setToDelete(null)
      setNotice(res.mode === 'archived'
        ? `${name} fue eliminado. Como tenía historial (reservas, inspecciones, etc.), su nombre se conserva en esos registros; su acceso quedó bloqueado y su correo libre para usarse de nuevo.`
        : `${name} fue eliminado por completo.`)
      router.refresh()
    })
  }

  return (
    <>
      {notice && (
        <div className="m-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-green-700 hover:text-green-900" aria-label="Cerrar">✕</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortLinkTh label="Usuario" sortKey="usuario" sort={sort} href={sortHref} />
              <SortLinkTh label="Rol"     sortKey="rol"     sort={sort} href={sortHref} />
              <SortLinkTh label="Estado"  sortKey="estado"  sort={sort} href={sortHref} />
              <SortLinkTh label="Alta"    sortKey="alta"    sort={sort} href={sortHref} className="hidden md:table-cell" />
              <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => {
              const initials = u.full_name
                .split(' ')
                .slice(0, 2)
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
              const roleInfo = roleLabels[u.role] ?? roleLabels.operator
              const isCurrentUser = u.id === currentUserId

              return (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {u.full_name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">(tú)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${roleInfo.className}`}>
                      {roleInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.active ? 'text-green-700' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Cambiar contraseña — disponible para todos (incluyendo el propio admin) */}
                      <button
                        onClick={() => setPwdModal({ id: u.id, name: u.full_name })}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Cambiar contraseña"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                        </svg>
                      </button>

                      {/* Activar/desactivar y eliminar — solo para otros usuarios */}
                      {!isCurrentUser && <ToggleActiveButton userId={u.id} active={u.active} />}
                      {!isCurrentUser && canDelete && (
                        <button
                          type="button"
                          onClick={() => { setDeleteError(''); setToDelete(u) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar usuario"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pwdModal && (
        <ChangePasswordModal
          userId={pwdModal.id}
          userName={pwdModal.name}
          onClose={() => setPwdModal(null)}
        />
      )}

      {/* Confirmación de eliminar */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !pending) setToDelete(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="del-user-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </span>
              <div>
                <h3 id="del-user-title" className="text-base font-semibold text-gray-900">¿Eliminar a {toDelete.full_name}?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Ya no podrá iniciar sesión y dejará de aparecer en Usuarios. Esta acción no se puede deshacer.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Si registró reservas, inspecciones, cargos u otros movimientos, su nombre se conserva en ese historial
                  y su correo queda libre para crear otro usuario. Si solo quieres quitarle el acceso por un tiempo, usa &ldquo;Desactivar&rdquo;.
                </p>
              </div>
            </div>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => setToDelete(null)} disabled={pending}
                className="px-4 py-2 text-[14px] text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmDelete} disabled={pending}
                className="px-4 py-2 text-[14px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60">
                {pending ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
