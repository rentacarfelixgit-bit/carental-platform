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
  try {
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

    const admin = createAdminClient(currentUser.id)

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al crear el usuario'
    return { error: msg }
  }
}

export async function changeUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success?: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', currentUser.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return { error: 'No tienes permisos para cambiar contraseñas.' }
  }

  // Verificar que el usuario objetivo pertenece al mismo tenant
  const { data: targetUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!targetUser) return { error: 'Usuario no encontrado.' }

  const admin = createAdminClient(currentUser.id)
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: `Error al cambiar la contraseña: ${error.message}` }

  return { success: true }
}

// Contexto del admin que hace la acción
async function getAdminCtx() {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return null
  const { data: profile } = await supabase
    .from('users').select('tenant_id, role').eq('id', currentUser.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return null
  return { currentUserId: currentUser.id, tenantId: profile.tenant_id as string }
}

// ¿Quedaría el negocio sin ningún administrador activo?
async function isLastActiveAdmin(admin: ReturnType<typeof createAdminClient>, tenantId: string, userId: string) {
  const { data: target } = await admin.from('users').select('role, active').eq('id', userId).eq('tenant_id', tenantId).single()
  if (!target || target.role === 'operator' || !target.active) return false
  const { count } = await admin.from('users').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).in('role', ['admin', 'superadmin']).eq('active', true).neq('id', userId)
  return (count ?? 0) === 0
}

// Bloqueo real del acceso: un usuario inactivo no puede iniciar sesión ni renovar su sesión
const BAN_FOREVER = '876000h' // ~100 años

export async function toggleUserActive(userId: string, active: boolean) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: 'No autorizado' }
  if (userId === ctx.currentUserId) return { error: 'No puedes desactivar tu propio usuario.' }

  const admin = createAdminClient(ctx.currentUserId)
  if (!active && await isLastActiveAdmin(admin, ctx.tenantId, userId))
    return { error: 'Debe quedar al menos un administrador activo.' }

  const { data: updated, error } = await admin
    .from('users')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select('id')
  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Usuario no encontrado.' }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : BAN_FOREVER })
  if (banError) return { error: `Se cambió el estado pero no se pudo ${active ? 'reactivar' : 'bloquear'} el acceso: ${banError.message}` }

  revalidatePath('/dashboard/usuarios')
  return { success: true }
}

export type DeleteUserResult = { success?: boolean; error?: string; mode?: 'deleted' | 'archived' }

/**
 * Eliminar usuario.
 * - Sin historial: se borra por completo (perfil y cuenta de acceso).
 * - Con historial (creó reservas, inspecciones, cargos…): no se puede borrar sin perder quién hizo
 *   cada cosa, así que se da de baja: deja de aparecer en Usuarios, su cuenta se bloquea y su
 *   correo queda libre para volver a usarse. Su nombre se sigue viendo en el historial.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: 'No autorizado' }
  if (userId === ctx.currentUserId) return { error: 'No puedes eliminar tu propio usuario.' }

  const admin = createAdminClient(ctx.currentUserId)
  const { data: target } = await admin.from('users').select('id, email')
    .eq('id', userId).eq('tenant_id', ctx.tenantId).is('deleted_at', null).single()
  if (!target) return { error: 'Usuario no encontrado.' }
  if (await isLastActiveAdmin(admin, ctx.tenantId, userId))
    return { error: 'No puedes eliminar al último administrador activo.' }

  // 1. Intentar borrado completo
  const { error: delError } = await admin.from('users').delete().eq('id', userId).eq('tenant_id', ctx.tenantId)
  if (!delError) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    if (authError && !/not.?found/i.test(authError.message)) {
      // El perfil ya no existe; la cuenta de acceso queda bloqueada como respaldo
      await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER })
    }
    revalidatePath('/dashboard/usuarios')
    return { success: true, mode: 'deleted' }
  }

  // 2. Tiene historial (llave foránea) → dar de baja conservando su nombre en el historial
  if (delError.code !== '23503') return { error: delError.message }
  const freedEmail = `eliminado-${userId.slice(0, 8)}-${Date.now().toString(36)}@usuarios-eliminados.invalid`
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: freedEmail, ban_duration: BAN_FOREVER })
  if (authError) return { error: `No se pudo bloquear la cuenta: ${authError.message}` }
  const { error: archError } = await admin.from('users').update({
    active: false, deleted_at: new Date().toISOString(), email: freedEmail, updated_at: new Date().toISOString(),
  }).eq('id', userId).eq('tenant_id', ctx.tenantId)
  if (archError) return { error: archError.message }

  revalidatePath('/dashboard/usuarios')
  return { success: true, mode: 'archived' }
}
