// src/app/dashboard/flota/[id]/mantenimiento/page.tsx
// Alertas de mantenimiento por vehículo — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewAlertForm from './NewAlertForm'
import ResolveAlertButton from './ResolveAlertButton'

const ALERT_TYPE_LABELS: Record<string, string> = {
  oil_change:           'Cambio de aceite',
  insurance_renewal:    'Renovación de seguro',
  tires:                'Llantas',
  technical_inspection: 'Revisión técnica',
  custom:               'Personalizada',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function MantenimientoPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  const isAdmin = profile.role === 'admin'

  // Datos del vehículo
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, plates, brand, model, year')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!vehicle) redirect('/dashboard/flota')

  // Alertas del vehículo: primero abiertas, luego resueltas
  const { data: alerts } = await supabase
    .from('vehicle_maintenance_alerts')
    .select('id, alert_type, description, due_date, due_km, resolved, resolved_at, created_at')
    .eq('vehicle_id', id)
    .eq('tenant_id', profile.tenant_id)
    .order('resolved',    { ascending: true  })
    .order('created_at',  { ascending: false })

  const open   = alerts?.filter(a => !a.resolved) ?? []
  const closed = alerts?.filter(a =>  a.resolved) ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <Link
          href="/dashboard/flota"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Flota
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Mantenimiento</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {vehicle.brand} {vehicle.model} {vehicle.year} · {vehicle.plates}
            </p>
          </div>
          {open.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {open.length} alerta{open.length !== 1 ? 's' : ''} abierta{open.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Formulario nueva alerta — solo admin */}
      {isAdmin && <NewAlertForm vehicleId={id} />}

      {/* Alertas abiertas */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Alertas abiertas</h2>
        {open.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Sin alertas pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {open.map(a => (
              <AlertCard
                key={a.id}
                alert={a}
                vehicleId={id}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </section>

      {/* Historial resueltas */}
      {closed.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Historial resueltas ({closed.length})
          </h2>
          <div className="space-y-2">
            {closed.map(a => (
              <AlertCard
                key={a.id}
                alert={a}
                vehicleId={id}
                isAdmin={isAdmin}
                resolved
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Tarjeta de alerta ─────────────────────────────────────────────────────────

interface Alert {
  id: string
  alert_type: string
  description: string | null
  due_date: string | null
  due_km: number | null
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

function AlertCard({
  alert, vehicleId, isAdmin, resolved = false,
}: {
  alert: Alert
  vehicleId: string
  isAdmin: boolean
  resolved?: boolean
}) {
  const isOverdue = !resolved && alert.due_date && new Date(alert.due_date) < new Date()

  return (
    <div
      className={`flex items-start justify-between gap-4 p-4 rounded-xl border ${
        resolved
          ? 'border-gray-100 bg-gray-50 opacity-60'
          : isOverdue
            ? 'border-red-200 bg-red-50'
            : 'border-orange-200 bg-orange-50'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
          </span>
          {isOverdue && (
            <span className="text-xs font-medium text-red-600">⚠ Vencida</span>
          )}
          {resolved && (
            <span className="text-xs text-green-700">
              ✓ Resuelta{' '}
              {alert.resolved_at
                ? new Date(alert.resolved_at).toLocaleDateString('es-MX')
                : ''}
            </span>
          )}
        </div>
        {alert.description && (
          <p className="text-xs text-gray-600 mt-0.5">{alert.description}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
          {alert.due_date && (
            <span>📅 {new Date(alert.due_date).toLocaleDateString('es-MX')}</span>
          )}
          {alert.due_km && (
            <span>🔢 {alert.due_km.toLocaleString()} km</span>
          )}
          <span>Creada {new Date(alert.created_at).toLocaleDateString('es-MX')}</span>
        </div>
      </div>

      {isAdmin && !resolved && (
        <div className="shrink-0">
          <ResolveAlertButton alertId={alert.id} vehicleId={vehicleId} />
        </div>
      )}
    </div>
  )
}
