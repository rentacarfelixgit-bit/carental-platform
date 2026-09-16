// src/app/dashboard/reservas/[id]/inspecciones/[type]/page.tsx

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import InspeccionForm from './InspeccionForm'

interface Props {
  params: Promise<{ id: string; type: string }>
}

export interface BaselinePhoto {
  id: string
  signedUrl: string
  angle: string | null
}

export default async function InspeccionTypePage({ params }: Props) {
  const { id, type } = await params

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

  // Verificar que no existe ya esa inspección
  const { data: existing } = await supabase
    .from('inspections')
    .select('id')
    .eq('reservation_id', id)
    .eq('type', type)
    .maybeSingle()

  if (existing) redirect(`/dashboard/reservas/${id}/inspecciones`)

  const v = reservation.vehicles as unknown as { brand: string; model: string; plates: string } | null
  const vehicleLabel = v ? `${v.brand} ${v.model} · ${v.plates}` : ''

  // ── Fotos base del vehículo ──────────────────────────────────────────────
  let baselinePhotos: BaselinePhoto[] = []

  const vehicleId = (reservation as unknown as { vehicle_id: string }).vehicle_id
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
    />
  )
}
