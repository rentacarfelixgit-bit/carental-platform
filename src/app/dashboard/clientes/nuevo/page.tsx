'use client'

// src/app/dashboard/clientes/nuevo/page.tsx

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient_ } from '../actions'
import ClientForm from '../ClientForm'

export default function NuevoClientePage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createClient_, {})

  useEffect(() => {
    if (state.success) router.push('/dashboard/clientes')
  }, [state.success, router])

  return (
    <ClientForm
      action={action}
      state={state}
      pending={pending}
      title="Agregar cliente"
      submitLabel="Agregar cliente"
    />
  )
}
