import { redirect } from 'next/navigation'

// El calendario se movió a /dashboard/reservas/calendario
export default function CalendarioRedirect() {
  redirect('/dashboard/reservas/calendario')
}
