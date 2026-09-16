'use client'

import { useActionState } from 'react'
import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateVehicle } from '../../actions'
import VehicleForm from '../../VehicleForm'
import ToggleVehicleButton from './ToggleVehicleButton'
import VehiclePhotos from './VehiclePhotos'

export default function EditarVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [vehicle,  setVehicle]  = useState<Record<string, unknown> | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)

  const boundUpdate = updateVehicle.bind(null, id)
  const [state, action, pending] = useActionState(boundUpdate, {})

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile?.tenant_id) return
          setTenantId(profile.tenant_id)
          supabase
            .from('vehicles')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', profile.tenant_id)
            .single()
            .then(({ data }) => setVehicle(data))
        })
    })
  }, [id])

  if (!vehicle || !tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <>
      <VehicleForm
        action={action}
        state={state}
        pending={pending}
        vehicle={vehicle as never}
        title={`Editar — ${vehicle.brand} ${vehicle.model}`}
        submitLabel="Guardar cambios"
      />
      <ToggleVehicleButton
        vehicleId={id}
        active={vehicle.active as boolean}
      />
      <VehiclePhotos
        vehicleId={id}
        tenantId={tenantId}
      />
    </>
  )
}
