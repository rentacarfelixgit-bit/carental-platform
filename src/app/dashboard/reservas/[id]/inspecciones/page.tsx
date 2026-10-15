// src/app/dashboard/reservas/[id]/inspecciones/page.tsx
// Resumen de inspecciones (checkout / checkin) de una reserva — Server Component

import Link from 'next/link'
import { rentalFolio, rentalKind } from '@/lib/rentalLabels'
import { PHOTO_ANGLES, angleLabel } from '@/lib/photoAngles'
import { SWAP_REASONS, type SwapReason } from '@/lib/vehicleSwap'
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
  id: string; storage_path: string; signedUrl: string; angle: string | null
}

interface Inspection {
  id: string; type: string; odometer: number; fuel_level: string
  notes: string | null; completed_at: string
  swap_id: string | null; vehicle_id: string | null
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
    .select('id, number, origin, status, vehicles ( brand, model, plates )')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!reservation) redirect('/dashboard/reservas')

  const { data: inspections } = await supabase
    .from('inspections')
    .select(`
      id, type, odometer, fuel_level, notes, completed_at, swap_id, vehicle_id,
      inspection_damage_points ( id, zone, severity, description, x_pct, y_pct ),
      inspection_photos ( id, storage_path, angle )
    `)
    .eq('reservation_id', id)
    .order('completed_at')

  // Generar signed URLs para todas las fotos de inspección (bucket privado)
  const rawInspections = inspections ?? []
  const allPaths = rawInspections.flatMap(i =>
    (i.inspection_photos ?? []).map((p: { id: string; storage_path: string }) => p.storage_path)
  )
  const signedUrlMap: Record<string, string> = {}
  if (allPaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('inspection-photos')
      .createSignedUrls(allPaths, 3600)
    signedData?.forEach(item => {
      // item.path contiene el storage_path relativo
      if (item.signedUrl && item.path) signedUrlMap[item.path] = item.signedUrl
    })
  }

  // Enriquecer las fotos con la signed URL
  const enriched = rawInspections.map(i => ({
    ...i,
    inspection_photos: (i.inspection_photos ?? []).map(
      (p: { id: string; storage_path: string; angle: string | null }) => ({
        ...p,
        signedUrl: signedUrlMap[p.storage_path] ?? '',
      })
    ),
  }))

  // ── Tramos de la renta: salida principal → (cambios de vehículo) → regreso principal ──
  const all = enriched as Inspection[]
  const checkout = all.find(i => i.type === 'checkout' && !i.swap_id)
  const checkin  = all.find(i => i.type === 'checkin'  && !i.swap_id)

  type V = { brand: string; model: string; plates: string } | null
  const one = <T,>(v: unknown) => (Array.isArray(v) ? v[0] : v) as T
  const vLabel = (v: V) => v ? `${v.brand} ${v.model} · ${v.plates}` : ''

  const { data: swapRows } = await supabase
    .from('reservation_vehicle_swaps')
    .select(`id, status, reason, swap_at,
      from_vehicle:vehicles!reservation_vehicle_swaps_from_vehicle_id_fkey ( brand, model, plates ),
      to_vehicle:vehicles!reservation_vehicle_swaps_to_vehicle_id_fkey ( brand, model, plates )`)
    .eq('reservation_id', id)
    .eq('tenant_id', profile.tenant_id)
    .neq('status', 'cancelled')
    .order('created_at')
  const swaps = (swapRows ?? []).map(sw => ({
    id: sw.id, status: sw.status as string, reason: sw.reason as SwapReason, swapAt: sw.swap_at as string,
    from: vLabel(one<V>(sw.from_vehicle)), to: vLabel(one<V>(sw.to_vehicle)),
    checkin:  all.find(i => i.swap_id === sw.id && i.type === 'checkin'),
    checkout: all.find(i => i.swap_id === sw.id && i.type === 'checkout'),
  }))
  const openSwap = swaps.some(sw => sw.status === 'in_progress')
  const canInspect = reservation.status !== 'cancelled'

  const v = reservation.vehicles as unknown as { brand: string; model: string; plates: string } | null

  // Vehículo de la salida principal = el "from" del primer cambio (o el actual si no hubo cambios)
  const firstVehicle = swaps[0]?.from ?? vLabel(v)
  const lastVehicle  = vLabel(v)

  // Pares salida → regreso de un mismo vehículo, para comparar
  const legs: { label: string; out?: Inspection; back?: Inspection }[] = []
  if (swaps.length === 0) {
    legs.push({ label: lastVehicle, out: checkout, back: checkin })
  } else {
    legs.push({ label: swaps[0].from, out: checkout, back: swaps[0].checkin })
    swaps.forEach((sw, k) => legs.push({
      label: sw.to, out: sw.checkout, back: k + 1 < swaps.length ? swaps[k + 1].checkin : checkin,
    }))
  }
  const zonesOf = (insp?: Inspection) => insp ? new Set(insp.inspection_damage_points.map(d => d.zone)) : null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/dashboard/reservas/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {rentalKind(reservation.origin)} {rentalFolio(reservation.origin, reservation.number)}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Inspecciones</h1>
        {v && <p className="text-sm text-gray-500 mt-0.5">{v.brand} {v.model} · {v.plates}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <InspectionCard
          title="Entrega del vehículo (checkout)"
          subtitle={swaps.length ? firstVehicle : undefined}
          inspection={checkout ?? null}
          type="checkout"
          reservationId={id}
          canCreate={canInspect && !checkout}
          accentColor="blue"
          checkoutZones={null}
        />

        {swaps.map((sw, k) => (
          <div key={sw.id} className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-indigo-700">
              <span className="h-px flex-1 bg-indigo-100" />
              <span className="font-medium">
                Cambio de vehículo · {new Date(sw.swapAt).toLocaleDateString('es-MX')} · {SWAP_REASONS[sw.reason]?.label}
                {sw.status === 'in_progress' && ' · en proceso'}
              </span>
              <span className="h-px flex-1 bg-indigo-100" />
            </div>
            <InspectionCard
              title="Recepción del vehículo anterior"
              subtitle={sw.from}
              inspection={sw.checkin ?? null}
              type="checkin"
              reservationId={id}
              canCreate={false}
              createHref={sw.status === 'in_progress' ? `/dashboard/reservas/${id}/cambio-vehiculo` : undefined}
              accentColor="green"
              checkoutZones={zonesOf(legs[k]?.out)}
            />
            <InspectionCard
              title="Entrega del vehículo nuevo"
              subtitle={sw.to}
              inspection={sw.checkout ?? null}
              type="checkout"
              reservationId={id}
              canCreate={false}
              createHref={sw.status === 'in_progress' ? `/dashboard/reservas/${id}/cambio-vehiculo` : undefined}
              accentColor="blue"
              checkoutZones={null}
            />
          </div>
        ))}

        <InspectionCard
          title="Recepción del vehículo (check-in)"
          subtitle={swaps.length ? lastVehicle : undefined}
          inspection={checkin ?? null}
          type="checkin"
          reservationId={id}
          canCreate={canInspect && !checkin && !openSwap}
          accentColor="green"
          checkoutZones={zonesOf(legs[legs.length - 1]?.out)}
        />
      </div>

      {/* ── Comparativa por vehículo ────────────────────────────────────── */}
      {legs.filter(l => l.out && l.back).map((l, k) => (
        <DamageComparison key={k} checkout={l.out!} checkin={l.back!} title={swaps.length ? l.label : undefined} />
      ))}
    </div>
  )
}

// ── Tarjeta de inspección ─────────────────────────────────────────────────────

function InspectionCard({
  title, subtitle, inspection, type, reservationId, canCreate, createHref, accentColor, checkoutZones,
}: {
  title: string
  subtitle?: string
  /** Enlace alternativo cuando la inspección se registra desde otro flujo (cambio de vehículo) */
  createHref?: string
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
            <p className="text-xs text-gray-400 mt-0.5">{subtitle ? `${subtitle} · ` : ''}Sin registrar</p>
          </div>
          {!canCreate && createHref && (
            <Link href={createHref} className={`text-sm px-4 py-2 rounded-lg text-white transition-colors ${c.btn}`}>
              Ir al cambio
            </Link>
          )}
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
          {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
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
        {photos.map(photo => (
          <a
            key={photo.id}
            href={photo.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.signedUrl}
              alt={angleLabel(photo.angle) ?? 'Foto de inspección'}
              className="w-full h-full object-cover"
            />
            {angleLabel(photo.angle) && (
              <span className="absolute bottom-1 left-1 px-1 py-0.5 text-[10px] font-medium bg-black/60 text-white rounded">
                {angleLabel(photo.angle)}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Sección de comparativa ────────────────────────────────────────────────────

function DamageComparison({ checkout, checkin, title }: { checkout: Inspection; checkin: Inspection; title?: string }) {
  const checkoutZones = new Set(checkout.inspection_damage_points.map(d => d.zone))
  const newDamages    = checkin.inspection_damage_points.filter(d => !checkoutZones.has(d.zone))
  const kmDiff = checkin.odometer - checkout.odometer

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700">Comparativa checkout → check-in{title ? ` · ${title}` : ''}</h2>
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

        {/* Fotos por ángulo: salida vs regreso */}
        <AngleComparison checkout={checkout.inspection_photos} checkin={checkin.inspection_photos} />

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

// ── Comparativa de fotos por ángulo ───────────────────────────────────────────

function AngleComparison({ checkout, checkin }: { checkout: InspectionPhoto[]; checkin: InspectionPhoto[] }) {
  const groups = [...PHOTO_ANGLES, null].map(angle => ({
    angle,
    label: angle ? angleLabel(angle) : 'Sin ángulo',
    out:  checkout.filter(p => (p.angle ?? null) === angle),
    back: checkin.filter(p => (p.angle ?? null) === angle),
  })).filter(g => g.out.length > 0 || g.back.length > 0)

  if (groups.length === 0) return null

  const Thumbs = ({ photos, empty }: { photos: InspectionPhoto[]; empty: string }) =>
    photos.length > 0 ? (
      <div className="flex gap-1.5 flex-wrap">
        {photos.map(p => (
          <a key={p.id} href={p.signedUrl} target="_blank" rel="noopener noreferrer"
            className="block w-24 aspect-[4/3] rounded-md overflow-hidden bg-gray-100 hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.signedUrl} alt="" className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
    ) : (
      <p className="text-xs text-gray-400 italic py-2">{empty}</p>
    )

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Fotos por ángulo</p>
      <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
        <div className="grid grid-cols-[6.5rem_1fr_1fr] gap-3 px-3 py-2 bg-gray-50 text-[11px] font-medium text-gray-500">
          <span>Ángulo</span><span>Salida</span><span>Regreso</span>
        </div>
        {groups.map(g => (
          <div key={g.angle ?? 'none'} className="grid grid-cols-[6.5rem_1fr_1fr] gap-3 px-3 py-2 items-start">
            <span className="text-xs font-medium text-gray-700 pt-1">{g.label}</span>
            <Thumbs photos={g.out}  empty="Sin foto" />
            <Thumbs photos={g.back} empty="Sin foto" />
          </div>
        ))}
      </div>
    </div>
  )
}
