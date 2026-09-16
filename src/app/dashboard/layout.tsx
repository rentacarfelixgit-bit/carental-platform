import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, tenant_id')
    .eq('id', user.id)
    .single()


  const userName = profile?.full_name ?? user.email ?? 'Usuario'
  const userEmail = user.email ?? ''
  const userRole  = profile?.role ?? 'operator'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar userEmail={userEmail} userName={userName} userRole={userRole} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden h-14 flex-shrink-0" />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
