// Protección de rutas por autenticación y rol.
// Documentación @supabase/ssr: https://supabase.com/docs/guides/auth/server-side/nextjs

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/auth/callback']

const SUPERADMIN_ROUTES = ['/superadmin']

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Rutas públicas ─────────────────────────────────────────────────────────
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── Autenticación requerida ────────────────────────────────────────────────
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Rutas de superadmin ────────────────────────────────────────────────────
  if (SUPERADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const superadminEmail = process.env.SUPERADMIN_EMAIL
    if (!superadminEmail || user.email !== superadminEmail) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Redirect raíz ─────────────────────────────────────────────────────────
  if (pathname === '/') {
    if (user.email === process.env.SUPERADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/superadmin', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // TODO (R16): Cuando se implementen JWT custom claims, agregar aquí el check
  // de rol (admin vs operator) para proteger rutas como /settings o /reports
  // que solo deben ser accesibles por admins.
  //
  // Ejemplo futuro:
  // const role = user.app_metadata?.role
  // if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r)) && role !== 'admin') {
  //   return NextResponse.redirect(new URL('/dashboard', request.url))
  // }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
