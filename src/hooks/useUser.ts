'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export type UserRole = 'superadmin' | 'admin' | 'operator'

export interface CurrentUser {
  id: string
  email: string
  tenantId: string
  role: UserRole
  isAdmin: boolean
  isSuperadmin: boolean
}

interface UseUserReturn {
  user: CurrentUser | null
  loading: boolean
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      // getUser() valida el token con el servidor (seguro)
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }

      // getSession() para leer los JWT claims (ya validados por getUser)
      const { data: { session } } = await supabase.auth.getSession()
      const claims = decodeJwtClaims(session?.access_token)

      const role = (claims?.user_role ?? 'operator') as UserRole
      const tenantId = claims?.tenant_id ?? ''

      setUser({
        id: authUser.id,
        email: authUser.email ?? '',
        tenantId,
        role,
        isAdmin: role === 'admin' || role === 'superadmin',
        isSuperadmin: role === 'superadmin',
      })
      setLoading(false)
    }

    loadUser()

    // Actualizar cuando cambie la sesión (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}

// Decodifica la parte de payload del JWT (no valida firma — solo para leer claims)
function decodeJwtClaims(token?: string): Record<string, string> | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}
