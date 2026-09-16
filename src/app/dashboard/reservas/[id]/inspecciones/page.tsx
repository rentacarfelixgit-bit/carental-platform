// src/app/dashboard/reservas/[id]/inspecciones/page.tsx
// Resumen de inspecciones (checkout / checkin) de una reserva — Server Component

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const FUEL_LABELS: Record<string, string> = {
  full:           'Lleno (100%)',
  three_quarters: '3/4 (75%)',
  half:           'Mitad (50%)',
  quarter:        '1/4 (25%)',
  empty:          'Vacío',
}

const ZONE_LABELS: Record<string, string> = {
  front:    'Frontal', rear: 'Trasera', left: 'Lateral izq.',
  right:    'Lateral der.', top: 'Techo/capó', interior: 'Interior',
}

const SEVERITY_LABELS: Record<string, string> = {
  scratch: 'Rayón', dent: 'Abolladura', crack: 'Grieta',
  missing: 'Pieza faltante', other: 'Otro',
}

const SEVERITY_COLORS: Record<string, string> = {
  scratch: 'bg-yellow-100 text-yellow-700',
  dent:    'bg-red-100 text-red-700',
  crack:   'bg-purple-100 text-purple-700',
  missing: 'bg-pink-100 text-pink-700',
  other:   'bg-gray-100 text-gray-600',
}

interface Props {
  params: Promise<{ id: string }>
}

interface DamagePoint {
  id: string; zone: string; severity: string
  description: string | null; x_pct: number; y_pct: number
}

interface InspectionPhoto {
  id: string; storage_path: string
}

interface Inspection {
  id: string; type: string; odometer: number; fuel_level: string
  notes: string | null; completed_at: string
  inspection_damage_points: DamagePoint[]
  inspection_photos: InspectionPhoto[]
}

export default async function InspeccionesResumenPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id) redirect('/login')

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, status, vehicles ( brand, model, plates )')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!reservation) redirect('/dashboard/reservas')

  const { data: inspections } = await supabase
    .from('inspections')
    .select(`
      id, type, odometer, fuel_level, notes, completed_at,
      inspection_damage_points ( id, zone, severity, description, x_pct, y_pct ),
      inspection_photos ( id, storage_path )
    `)
    .eq('reservation_id', id)
    .order('completed_at')

  const checkout = inspections?.find(i => i.type === 'checkout') as Inspection | undefined
  const checkin  = inspections?.find(i => i.type === 'checkin')  as Inspection | undefined
  const canInspect = reservation.status !== 'cancelled'

  const v = reservation.vehicles as { brand: string; model: string; plates: string } | null

  // Zonas con daño en el checkout (para la comparativa)
  const checkoutZones = new Set((checkout?.inspection_damage_points ?? []).map(d => d.zone))

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/dashboard/reservas/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Reserva
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Inspecciones</h1>
        {v && <p className="text-sm text-gray-500 mt-0.5">{v.brand} {v.model} · {v.plates}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <InspectionCard
          title="Entrega del vehículo (checkout)"
          inspection={checkout ?? null}
          type="checkout"
          reservationId={id}
          canCreate={canInspect && !checkout}
          accentColor="blue"
          checkoutZones={null}
        />

        <InspectionCard
          title="Recepción del vehículo (check-in)"
          inspection={checkin ?? null}
          type="checkin"
          reservationId={id}
          canCreate={canInspect && !checkin}
          accentColor="green"
          checkoutZones={checkout ? checkoutZones : null}
        />
      </div>

      {/* ── Comparativa ─────────────────────────────────────────────────── */}
      {checkout && checkin && (
        <DamageComparison checkout={checkout} checkin={checkin} />
      )}
    </div>
  )
}

// ── Tarjeta de inspección ─────────────────────────────────────────────────────

function InspectionCard({
  title, inspection, type, reservationId, canCreate, accentColor, checkoutZones,
}: {
  title: string
  inspection: Inspection | null
  type: string
  reservationId: string
  canCreate: boolean
  accentColor: 'blue' | 'green'
  checkoutZones: Set<string> | null
}) {
  const colorMap = {
    blue:  { border: 'border-blue-100',  bg: 'bg-blue-50',  text: 'text-blue-700',  btn: 'bg-blue-600 hover:bg-blue-700' },
    green: { border: 'border-green-100', bg: 'bg-green-50', text: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
  }
  const c = colorMap[accentColor]

  if (!inspection) {
    return (
      <div className={`border ${c.border} rounded-xl p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-700">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sin registrar</p>
          </div>
          {canCreate && (
            <Link
              href={`/dashboard/reservas/${reservationId}/inspecciones/${type}`}
              className={`text-sm px-4 py-2 rounded-lg text-white transition-colors ${c.btn}`}
            >
              Registrar
            </Link>
          )}
        </div>
      </div>
    )
  }

  const damages = inspection.inspection_damage_points ?? []
  const photos  = inspection.inspection_photos ?? []

  return (
    <div className={`border ${c.border} rounded-xl overflow-hidden`}>
      <div className={`${c.bg} px-5 py-3 flex items-center justify-between`}>
        <div>
          <h2 className={`text-sm font-medium ${c.text}`}>{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(inspection.completed_at).toLocaleString('es-MX')}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
          Registrada
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Odómetro y combustible */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Odómetro</p>
            <p className="font-medium text-gray-900">{inspection.odometer.toLocaleString()} km</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Combustible</p>
            <p className="font-medium text-gray-900">{FUEL_LABELS[inspection.fuel_level] ?? inspection.fuel_level}</p>
          </div>
        </div>

        {/* Notas */}
        {inspection.notes && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Notas</p>
            <p className="text-sm text-gray-600">{inspection.notes}</p>
          </div>
        )}

        {/* Daños con indicador nuevo/preexistente */}
        {damages.length > 0 ? (
          <div>
            <p className="text-xs text-gray-400 mb-2">{damages.length} punto{damages.length !== 1 ? 's' : ''} de daño</p>
            <div className="space-y-1.5">
              {damages.map((d, i) => {
                const isNew = checkoutZones !== null && !checkoutZones.has(d.zone)
                return (
                  <div key={d.id} className="flex items-start gap-2 text-xs">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[d.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                      {i + 1}
                    </span>
                    <span className="text-gray-600 flex-1">
                      <span className="font-medium">{ZONE_LABELS[d.zone] ?? d.zone}</span>
                      {' — '}{SEVERITY_LABELS[d.severity] ?? d.severity}
                      {d.description && `: ${d.description}`}
                    </span>
                    {checkoutZones !== null && (
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full font-medium ${isNew ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                        {isNew ? 'Nuevo' : 'Preexistente'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Sin daños registrados</p>
        )}

        {/* Fotos */}
        {photos.length > 0 && (
          <PhotoGrid photos={photos} />
        )}
      </div>
    </div>
  )
}

// ── Grid de fotos ─────────────────────────────────────────────────────────────

function PhotoGrid({ photos }: { photos: InspectionPhoto[] }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {photos.map(photo => {
          // Construir URL pública del bucket
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/inspection-photos/${photo.storage_path}`
          return (
            <a
              key={photo.id}
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl}
                alt="Foto de inspección"
                className="w-full h-full object-cover"
              />
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ── Sección de comparativa ────────────────────────────────────────────────────

function DamageComparison({ checkout, checkin }: { checkout: Inspection; checkin: Inspection }) {
  const checkoutZones = new Set(checkout.inspection_damage_points.map(d => d.zone))
  const newDamages    = checkin.inspection_damage_points.filter(d => !checkoutZones.has(d.zone))
  const kmDiff = checkin.odometer - checkout.odometer

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700">Comparativa checkout → check-in</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Kilómetros recorridos */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-0.5">Odómetro salida</p>
            <p className="font-medium text-gray-900">{checkout.odometer.toLocaleString()} km</p>
          </div>
          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-0.5">Odómetro regreso</p>
            <p className="font-medium text-gray-900">{checkin.odometer.toLocaleString()} km</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-400 mb-0.5">Recorrido</p>
            <p className={`font-semibold ${kmDiff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {kmDiff >= 0 ? '+' : ''}{kmDiff.toLocaleString()} km
            </p>
          </div>
        </div>

        {/* Combustible */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-0.5">Combustible salida</p>
            <p className="font-medium text-gray-900">{FUEL_LABELS[checkout.fuel_level]}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-0.5">Combustible regreso</p>
            <p className="font-medium text-gray-900">{FUEL_LABELS[checkin.fuel_level]}</p>
          </div>
        </div>

        {/* Daños nuevos */}
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Daños nuevos detectados al regreso
            {newDamages.length > 0 && (
              <span className="ml-1.5 text-red-600 font-medium">{newDamages.length}</span>
            )}
          </p>
          {newDamages.length > 0 ? (
            <div className="space-y-1.5">
              {newDamages.map((d, i) => (
                <div key={d.id} className="flex items-start gap-2 text-xs p-2 bg-red-50 rounded-lg border border-red-100">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </span>
                  <span className="text-gray-700">
                    <span className="font-medium">{ZONE_LABELS[d.zone] ?? d.zone}</span>
                    {' — '}{SEVERITY_LABELS[d.severity] ?? d.severity}
                    {d.description && `: ${d.description}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-600 font-medium">Sin daños nuevos — el vehículo regresó en el mismo estado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
