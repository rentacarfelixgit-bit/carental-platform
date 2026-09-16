'use client'

import { use, useActionState, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateClient } from '../../actions'
import ClientForm from '../../ClientForm'
import BlacklistSection from './BlacklistSection'
import RentalHistory from './RentalHistory'

interface BlacklistEntry {
  id: string
  reason: string
  added_at: string
}

interface ClientData {
  id: string
  full_name: string
  id_type: string
  id_number: string
  phone: string | null
  email: string | null
  license_number: string | null
  license_expiry: string | null
  notes: string | null
}

export default function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<ClientData | null>(null)
  const [blacklistEntry, setBlacklistEntry] = useState<BlacklistEntry | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const boundUpdate = updateClient.bind(null, id)
  const [state, action, pending] = useActionState(boundUpdate, {})

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile?.tenant_id) return
          setIsAdmin(profile.role === 'admin')

          // Fetch cliente filtrando por tenant_id (defensa en profundidad)
          supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', profile.tenant_id)
            .single()
            .then(({ data }) => setClient(data))

          // Fetch entrada activa de lista negra
          supabase
            .from('client_blacklist')
            .select('id, reason, added_at')
            .eq('client_id', id)
            .eq('tenant_id', profile.tenant_id)
            .eq('active', true)
            .maybeSingle()
            .then(({ data }) => setBlacklistEntry(data ?? null))
        })
    })
  }, [id])

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Alerta de licencia
  let licenseAlert: { type: 'expired' | 'soon'; daysLeft?: number } | null = null
  if (client.license_expiry) {
    const today = new Date(); today.setHours(0,0,0,0)
    const expiry = new Date(client.license_expiry); expiry.setHours(0,0,0,0)
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0)   licenseAlert = { type: 'expired' }
    else if (daysLeft <= 30) licenseAlert = { type: 'soon', daysLeft }
  }

  return (
    <>
      {/* Alerta de licencia */}
      {licenseAlert && (
        <div className={`mx-6 mt-6 p-3 rounded-xl border text-sm flex items-center gap-2 ${
          licenseAlert.type === 'expired'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-yellow-50 border-yellow-200 text-yellow-700'
        }`}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {licenseAlert.type === 'expired'
            ? 'La licencia de conducir de este cliente está vencida.'
            : `La licencia de conducir vence en ${licenseAlert.daysLeft} día${licenseAlert.daysLeft !== 1 ? 's' : ''}.`}
        </div>
      )}

      <ClientForm
        action={action}
        state={state}
        pending={pending}
        client={client}
        title={`Editar — ${client.full_name}`}
        submitLabel="Guardar cambios"
      />
      <BlacklistSection
        clientId={id}
        isAdmin={isAdmin}
        activeEntry={blacklistEntry}
      />
      <RentalHistory clientId={id} />
    </>
  )
}
