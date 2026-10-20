// src/app/auth/signout/route.ts
// Cierra la sesión (p. ej. cuando el usuario fue desactivado o eliminado) y regresa al login.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const motivo = request.nextUrl.searchParams.get('motivo')
  const url = new URL('/login', request.url)
  if (motivo === 'inactivo') url.searchParams.set('error', 'inactivo')
  return NextResponse.redirect(url)
}
