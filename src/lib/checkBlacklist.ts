// src/lib/checkBlacklist.ts
// Verifica si un cliente está en la lista negra del tenant.
// Usada en server actions de reservas antes de confirmar cualquier asignación.

import { createClient } from '@/lib/supabase/server'

export interface BlacklistStatus {
  blacklisted: boolean
  reason?: string
  addedAt?: string
  entryId?: string
}

/**
 * Consulta si `clientId` tiene una entrada activa en `client_blacklist`
 * dentro del tenant del usuario autenticado.
 *
 * RLS garantiza que solo se ven registros del propio tenant,
 * pero aun así filtramos explícitamente por `tenant_id` como
 * defensa en profundidad.
 *
 * @returns BlacklistStatus — `blacklisted: true` si hay entrada activa.
 */
export async function checkClientBlacklist(clientId: string): Promise<BlacklistStatus> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single()

  if (!profile?.tenant_id) return { blacklisted: false }

  const { data } = await supabase
    .from('client_blacklist')
    .select('id, reason, added_at')
    .eq('client_id', clientId)
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)
    .maybeSingle()

  if (!data) return { blacklisted: false }

  return {
    blacklisted: true,
    reason:      data.reason,
    addedAt:     data.added_at,
    entryId:     data.id,
  }
}
