// src/components/dashboard/AuditHistoryLink.tsx
// Botón "Historial": abre la Auditoría filtrada a un registro (renta, vehículo o cliente),
// con todos sus movimientos y los relacionados (inspecciones, cargos, cambios…). Solo admins.

import Link from 'next/link'

export default function AuditHistoryLink({ recordId, className = '' }: { recordId: string; className?: string }) {
  return (
    <Link
      href={`/dashboard/auditoria?registro=${recordId}`}
      title="Ver todos los movimientos de este registro en Auditoría"
      className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ${className}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Historial
    </Link>
  )
}
