// src/app/dashboard/admin/limpieza/page.tsx
// Herramienta de limpieza de fotos de inspección — solo admins

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CleanupForm from './CleanupForm'

export default async function LimpiezaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id || profile.role !== 'admin') redirect('/dashboard')

  // Estadísticas actuales
  const { count: totalPhotos } = await supabase
    .from('inspection_photos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/reportes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Reportes
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Limpieza de storage</h1>
        <p className="text-sm text-gray-500 mt-0.5">Elimina fotos antiguas de inspecciones para liberar espacio.</p>
      </div>

      {/* Estadística actual */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">Fotos almacenadas actualmente</p>
            <p className="text-2xl font-bold text-gray-900">{totalPhotos ?? 0}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Tamaño estimado</p>
            <p className="text-lg font-semibold text-gray-700">
              ~{(((totalPhotos ?? 0) * 300) / 1024).toFixed(1)} MB
            </p>
            <p className="text-xs text-gray-400">a 300 KB/foto promedio</p>
          </div>
        </div>
      </div>

      <CleanupForm />
    </div>
  )
}
