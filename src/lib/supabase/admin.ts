import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con la llave de servicio (salta RLS). Solo en el servidor.
 * `actorId`: usuario que realmente hace la acción, para que la Auditoría lo registre
 * (con la llave de servicio no hay sesión de la que tomarlo).
 */
export function createAdminClient(actorId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY no están configuradas.'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { headers: actorId ? { 'x-actor-id': actorId } : {} },
  })
}
