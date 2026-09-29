// src/middleware.ts
// Protección de rutas por autenticación y rol.
// Documentación @supabase/ssr: https://supabase.com/docs/guides/auth/server-side/nextjs
//
// R16: Los JWT custom claims (tenant_id, user_role) se agregan via
// custom_access_token_hook en Supabase → Authentication → Hooks.

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas que no requieren autenticación
const PUBLIC_ROUTES = ['/login', '/auth/callback']

// Prefijos de ruta exclusivos de superadmin
// (El panel de superadmin es una app independiente — no existe en este proyecto)
const SUPERADMIN_ROUTES: string[] = []

// Rutas solo para admin (no operator)
// El JWT hook está activo → user_role llega en el claim en cada sesión.
const ADMIN_ONLY_ROUTES: string[] = [
  '/dashboard/configuracion',
  '/dashboard/usuarios',
  '/dashboard/admin',
]

// Decodifica el payload del JWT para leer custom claims
function getJwtClaims(token?: string): Record<string, string> | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  // supabaseResponse debe devolverse siempre para que las cookies de sesión
  // se propaguen correctamente entre el cliente y el servidor.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Primero actualizar las cookies en el request
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Luego reemplazar la response para que lleve las cookies al browser
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: No escribir lógica entre createServerClient y getUser().
  // getUser() refresca el token si está expirado. Si se omite, la sesión
  // puede quedar desincronizada entre server y browser.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()
  const claims = getJwtClaims(session?.access_token)
  const userRole = claims?.user_role ?? 'operator'

  const { pathname } = request.nextUrl

  // ── Rutas públicas ─────────────────────────────────────────────────────────
  // Si el usuario ya está autenticado y va a /login, redirigir al dashboard
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── Autenticación requerida ────────────────────────────────────────────────
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    // Guardar la ruta original para redirigir después del login
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Rutas de superadmin ────────────────────────────────────────────────────
  // Solo el email configurado en SUPERADMIN_EMAIL puede acceder a /superadmin
  if (SUPERADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const superadminEmail = process.env.SUPERADMIN_EMAIL
    if (!superadminEmail || user.email !== superadminEmail) {
      // Admin normal → dashboard de su tenant
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Redirect raíz ─────────────────────────────────────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Rutas solo para admin ──────────────────────────────────────────────────
  if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto archivos estáticos y recursos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}