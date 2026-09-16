// src/app/dashboard/reservas/StatusBadge.tsx

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada', className: 'bg-blue-100 text-blue-700'    },
  active:    { label: 'En curso',   className: 'bg-green-100 text-green-700'  },
  completed: { label: 'Completada', className: 'bg-gray-100 text-gray-600'    },
  cancelled: { label: 'Cancelada',  className: 'bg-red-100 text-red-600'      },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
