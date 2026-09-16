'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const CreateUserSchema = z.object({
  email: z.string().email('Correo inválido'),
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['admin', 'operator'], { message: 'Rol inválido' }),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type CreateUserState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

export async function createUser(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  // 1. Validar campos
  const parsed = CreateUserSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const { email, full_name, role, password } = parsed.data

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', currentUser.id)
    .single()

  if (!profile?.tenant_id) return { error: 'No se pudo obtener el tenant' }
  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    return { error: 'No tienes permisos para crear usuarios' }
  }

  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, 
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return { error: 'Ya existe un usuario con ese correo.' }
    }
    return { error: `Error al crear el usuario: ${authError.message}` }
  }

  const { error: dbError } = await admin
    .from('users')
    .insert({
      id: authData.user.id,
      tenant_id: profile.tenant_id,
      email,
      full_name,
      role,
      updated_at: new Date().toISOString(),
    })

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: `Error al guardar el usuario: ${dbError.message}` }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: true }
}

export async function toggleUserActive(userId: string, active: boolean) {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', currentUser.id)
    .single()

  if (!profile || profile.role !== 'admin') return { error: 'No autorizado' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('users')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('tenant_id', profile.tenant_id) 

  if (error) return { error: error.message }

  revalidatePath('/dashboard/usuarios')
  return { success: true }
}
