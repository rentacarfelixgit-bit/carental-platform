'use client'

import { useState } from 'react'
import ToggleActiveButton from './ToggleActiveButton'
import ChangePasswordModal from './ChangePasswordModal'

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
}

export default function UsuariosTable({ usuarios, currentUserId }: Props) {
  const [pwdModal, setPwdModal] = useState<{ id: string; name: string } | null>(null)

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Usuario</th>
            <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Rol</th>
            <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Estado</th>
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
                    <div>
                      <p className="font-medium text-gray-900">
                        {u.full_name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">(tú)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{u.email}</p>
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

                    {/* Activar/desactivar — solo para otros usuarios */}
                    {!isCurrentUser && (
                      <ToggleActiveButton userId={u.id} active={u.active} />
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {pwdModal && (
        <ChangePasswordModal
          userId={pwdModal.id}
          userName={pwdModal.name}
          onClose={() => setPwdModal(null)}
        />
      )}
    </>
  )
}
