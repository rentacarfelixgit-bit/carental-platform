// src/app/dashboard/reservas/[id]/inspecciones/[type]/page.tsx

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import InspeccionForm from './InspeccionForm'

interface Props {
  params: Promise<{ id: string; type: string }>
  searchParams: Promise<{ swap?: string }>
}

export interface BaselinePhoto {
  id: string
  signedUrl: string
  angle: string | null
}

export default async function InspeccionTypePage({ params, searchParams }: Props) {
  const { id, type } = await params
  const { swap: swapParam } = await searchParams

  if (type !== 'checkout' && type !== 'checkin') redirect(`/dashboard/reservas/${id}/inspecciones`)

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
    .select('id, status, vehicle_id, vehicles ( brand, model, plates )')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!reservation) redirect('/dashboard/reservas')
  if (reservation.status === 'cancelled') redirect(`/dashboard/reservas/${id}/inspecciones`)

  // ── Cambio de vehículo: recepción del actual (checkin) / entrega del nuevo (checkout)
  let swapId: string | null = null
  let inspectedVehicleId = (reservation as unknown as { vehicle_id: string }).vehicle_id
  let v = reservation.vehicles as unknown as { brand: string; model: string; plates: string } | null
  if (swapParam) {
    const { data: swap } = await supabase
      .from('reservation_vehicle_swaps')
      .select(`id, status, from_vehicle_id, to_vehicle_id,
        from_vehicle:vehicles!reservation_vehicle_swaps_from_vehicle_id_fkey ( brand, model, plates ),
        to_vehicle:vehicles!reservation_vehicle_swaps_to_vehicle_id_fkey ( brand, model, plates )`)
      .eq('id', swapParam).eq('reservation_id', id).eq('tenant_id', profile.tenant_id).maybeSingle()
    if (!swap || swap.status !== 'in_progress') redirect(`/dashboard/reservas/${id}/cambio-vehiculo`)
    swapId = swap.id
    inspectedVehicleId = type === 'checkin' ? swap.from_vehicle_id : swap.to_vehicle_id
    const sv = type === 'checkin' ? swap.from_vehicle : swap.to_vehicle
    v = (Array.isArray(sv) ? sv[0] : sv) as typeof v
    // La entrega del nuevo va después de recibir el actual
    if (type === 'checkout') {
      const { data: rec } = await supabase.from('inspections').select('id').eq('swap_id', swapId).eq('type', 'checkin').maybeSingle()
      if (!rec) redirect(`/dashboard/reservas/${id}/cambio-vehiculo`)
    }
  }

  // Verificar que no existe ya esa inspección
  let existingQ = supabase.from('inspections').select('id').eq('reservation_id', id).eq('type', type)
  existingQ = swapId ? existingQ.eq('swap_id', swapId) : existingQ.is('swap_id', null)
  const { data: existing } = await existingQ.maybeSingle()

  if (existing) redirect(swapId ? `/dashboard/reservas/${id}/cambio-vehiculo` : `/dashboard/reservas/${id}/inspecciones`)

  const vehicleLabel = v ? `${v.brand} ${v.model} · ${v.plates}` : ''

  // ── Fotos base del vehículo ──────────────────────────────────────────────
  let baselinePhotos: BaselinePhoto[] = []

  const vehicleId = inspectedVehicleId
  if (vehicleId) {
    const { data: vPhotos } = await supabase
      .from('vehicle_photos')
      .select('id, storage_path, angle')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: true })

    if (vPhotos?.length) {
      const paths = vPhotos.map(p => p.storage_path)
      const { data: signedData } = await supabase.storage
        .from('vehicle-photos')
        .createSignedUrls(paths, 3600)

      baselinePhotos = vPhotos.map((p, i) => ({
        id:        p.id,
        signedUrl: signedData?.[i]?.signedUrl ?? '',
        angle:     p.angle ?? null,
      }))
    }
  }

  // UUID pre-generado: permite subir fotos a Storage antes del submit del form
  const inspectionId = randomUUID()

  return (
    <InspeccionForm
      reservationId={id}
      type={type as 'checkout' | 'checkin'}
      vehicleLabel={vehicleLabel}
      tenantId={profile.tenant_id}
      inspectionId={inspectionId}
      baselinePhotos={baselinePhotos}
      swapId={swapId}
    />
  )
}
