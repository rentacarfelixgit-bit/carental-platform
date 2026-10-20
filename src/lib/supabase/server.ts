import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Auditoría: IP y navegador reales del usuario (las peticiones a Supabase salen del servidor)
  let auditHeaders: Record<string, string> = {}
  try {
    const h = await headers()
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || ''
    const ua = h.get('user-agent') ?? ''
    auditHeaders = {
      ...(ip ? { 'x-audit-ip': ip.slice(0, 64) } : {}),
      ...(ua ? { 'x-audit-ua': ua.slice(0, 300) } : {}),
    }
  } catch { /* fuera de una petición (build, scripts) */ }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: auditHeaders },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se lanza cuando se llama desde un Server Component (sin acceso a
            // set de cookies). El middleware ya se encarga del refresh de sesión.
          }
        },
      },
    }
  )
}
