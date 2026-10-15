// src/app/dashboard/equipo/page.tsx
// Inventario de equipo (GPS, hotspots, sillas de bebé…): código fijo, estado y quién lo tiene.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EquipmentInventory, { type InventoryItem } from './EquipmentInventory'
import { rentalFolio } from '@/lib/rentalLabels'

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) redirect('/login')
  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin'

  const { data } = await supabase
    .from('equipment_items')
    .select(`
      id, code, type, name, status, notes,
      rental_equipment ( id, assigned_at, returned_at, reservations ( id, number, origin, end_date, clients ( full_name ) ) )
    `)
    .eq('tenant_id', profile.tenant_id)
    .order('type')
    .order('code')

  const items: InventoryItem[] = (data ?? []).map(it => {
    const rows = (it.rental_equipment ?? []) as unknown as {
      id: string; assigned_at: string; returned_at: string | null
      reservations: { id: string; number: number; origin: string; end_date: string; clients: { full_name: string } | null } | null
    }[]
    const open = rows.find(r => !r.returned_at)
    const r = open?.reservations
    return {
      id: it.id, code: it.code, type: it.type, name: it.name, status: it.status, notes: it.notes,
      usageCount: rows.length,
      holder: open && r ? {
        reservationId: r.id,
        folio: rentalFolio(r.origin, r.number),
        client: r.clients?.full_name ?? '—',
        since: open.assigned_at,
        due: r.end_date,
      } : null,
    }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Equipo</h1>
        <p className="text-sm text-gray-500 mt-0.5">GPS, hotspots, sillas de bebé y otros artículos que se entregan con las rentas</p>
      </div>
      <EquipmentInventory items={items} isAdmin={isAdmin} />
    </div>
  )
}
