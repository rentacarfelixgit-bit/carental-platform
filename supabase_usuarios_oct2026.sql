-- ═══════════════════════════════════════════════════════════════════════════
-- Usuarios: eliminar usuarios conservando el historial
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- Un usuario sin historial se borra por completo. Uno con historial (creó reservas, inspecciones,
-- cargos…) se marca con deleted_at: deja de aparecer, su acceso se bloquea y su nombre se conserva.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS users_tenant_active_idx ON public.users (tenant_id) WHERE deleted_at IS NULL;
NOTIFY pgrst, 'reload schema';

SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'deleted_at'
) AS deleted_at_existe;
