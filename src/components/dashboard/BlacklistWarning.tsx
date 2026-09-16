// src/components/dashboard/BlacklistWarning.tsx
// Muestra un aviso prominente cuando el cliente seleccionado está en lista negra.
// Se usa en el formulario de nueva reserva para bloquear o advertir al operador.

interface Props {
  reason: string
  addedAt?: string
  /** Si true, bloquea el submit (no se puede crear la reserva). Default: true */
  blocking?: boolean
}

export default function BlacklistWarning({ reason, addedAt, blocking = true }: Props) {
  return (
    <div className="flex gap-3 p-4 bg-red-50 border border-red-300 rounded-xl" role="alert">
      <div className="shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-800">
          Cliente en lista negra
        </p>
        <p className="text-sm text-red-700 mt-0.5">{reason}</p>
        {addedAt && (
          <p className="text-xs text-red-500 mt-1">
            Registrado el {new Date(addedAt).toLocaleDateString('es-MX')}
          </p>
        )}
        {blocking && (
          <p className="text-xs font-medium text-red-700 mt-2">
            No es posible crear una reserva para este cliente. Contacta al administrador.
          </p>
        )}
      </div>
    </div>
  )
}
