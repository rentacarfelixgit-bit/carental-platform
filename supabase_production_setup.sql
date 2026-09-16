-- =============================================================================
-- Rentflow – Setup completo de Supabase para PRODUCCIÓN
-- =============================================================================
-- ORDEN DE EJECUCIÓN:
--   1. Ejecutar `prisma migrate deploy` primero (crea todas las tablas base).
--   2. Ejecutar este archivo completo en Supabase SQL Editor.
--
-- Este archivo cubre todo lo que Prisma NO maneja:
--   0) Permisos de schema (necesarios después de cada prisma migrate reset)
--   A) Función helper get_my_tenant_id()
--   B) Hook de JWT custom claims (custom_access_token_hook)
--   C) RLS para todas las tablas
--   C) Columna tenant_id en inspection_photos + su RLS
--   D) Tabla vehicle_photos + su RLS
--   E) Buckets de Storage + políticas de acceso
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- 0. PERMISOS DE SCHEMA
-- Prisma crea las tablas pero NO otorga permisos a los roles de Supabase.
-- Esto hay que correrlo SIEMPRE después de prisma migrate reset.
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- CRÍTICO: supabase_auth_admin necesita USAGE en el schema para poder invocar
-- el custom_access_token_hook. Sin esto el hook falla con status 500 aunque
-- la función exista y tenga GRANT EXECUTE. Este permiso NO se restaura solo
-- después de prisma migrate reset — siempre debe incluirse aquí.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supabase_auth_admin;


-- ═══════════════════════════════════════════════════════════════════════════════
-- A. FUNCIÓN HELPER
-- ═══════════════════════════════════════════════════════════════════════════════

-- Devuelve el tenant_id del usuario autenticado consultando la tabla users.
-- Se usa en todas las políticas RLS para aislamiento multi-tenant.
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- B. HOOK DE JWT – custom_access_token_hook
-- Inyecta tenant_id y user_role en el JWT de cada usuario al autenticarse.
-- IMPORTANTE: después de ejecutar este SQL, ir a Supabase Dashboard →
--   Authentication → Hooks → "Custom Access Token" y apuntar a
--   public.custom_access_token_hook (si no estaba ya configurado).
-- ═══════════════════════════════════════════════════════════════════════════════

-- Policy especial para que supabase_auth_admin pueda leer users (necesario para el hook)
-- Se crea antes de la función para que esté disponible cuando se llame
CREATE POLICY "supabase_auth_admin_select_users" ON public.users
  FOR SELECT TO supabase_auth_admin
  USING (true);

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims       jsonb;
  v_tenant_id  uuid;
  v_role       text;
BEGIN
  claims := event->'claims';

  SELECT tenant_id, role
    INTO v_tenant_id, v_role
    FROM public.users
   WHERE id = (event->>'user_id')::uuid
   LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  END IF;

  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT SELECT ON TABLE public.users TO supabase_auth_admin;


-- ═══════════════════════════════════════════════════════════════════════════════
-- C. RLS – TABLAS GESTIONADAS POR PRISMA
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── tenants ─────────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_own" ON tenants
  FOR SELECT USING (id = get_my_tenant_id());

-- ─── tenant_features ─────────────────────────────────────────────────────────
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_tenant_features" ON tenant_features
  USING (tenant_id = get_my_tenant_id());

-- ─── users ───────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_users" ON users
  USING (tenant_id = get_my_tenant_id());

-- ─── vehicles ────────────────────────────────────────────────────────────────
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_vehicles" ON vehicles
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_vehicles" ON vehicles
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_vehicles" ON vehicles
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- ─── vehicle_maintenance_alerts ──────────────────────────────────────────────
ALTER TABLE vehicle_maintenance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_vehicle_maintenance_alerts" ON vehicle_maintenance_alerts
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_vehicle_maintenance_alerts" ON vehicle_maintenance_alerts
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_vehicle_maintenance_alerts" ON vehicle_maintenance_alerts
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_delete_vehicle_maintenance_alerts" ON vehicle_maintenance_alerts
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ─── vehicle_blocks ──────────────────────────────────────────────────────────
ALTER TABLE vehicle_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_vehicle_blocks" ON vehicle_blocks
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_vehicle_blocks" ON vehicle_blocks
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_delete_vehicle_blocks" ON vehicle_blocks
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ─── clients ─────────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_clients" ON clients
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_clients" ON clients
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_clients" ON clients
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- ─── client_blacklist ────────────────────────────────────────────────────────
ALTER TABLE client_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_client_blacklist" ON client_blacklist
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_client_blacklist" ON client_blacklist
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_client_blacklist" ON client_blacklist
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- ─── reservations ────────────────────────────────────────────────────────────
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_reservations" ON reservations
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_reservations" ON reservations
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_reservations" ON reservations
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- ─── reservation_extras ──────────────────────────────────────────────────────
-- Sin tenant_id propio; se aísla via JOIN con reservations.
ALTER TABLE reservation_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_reservation_extras" ON reservation_extras
  FOR SELECT USING (
    reservation_id IN (
      SELECT id FROM reservations WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "tenant_insert_reservation_extras" ON reservation_extras
  FOR INSERT WITH CHECK (
    reservation_id IN (
      SELECT id FROM reservations WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "tenant_delete_reservation_extras" ON reservation_extras
  FOR DELETE USING (
    reservation_id IN (
      SELECT id FROM reservations WHERE tenant_id = get_my_tenant_id()
    )
  );

-- ─── contracts ───────────────────────────────────────────────────────────────
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_contracts" ON contracts
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_contracts" ON contracts
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- ─── inspections ─────────────────────────────────────────────────────────────
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_inspections" ON inspections
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_inspections" ON inspections
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- ─── inspection_damage_points ────────────────────────────────────────────────
-- Sin tenant_id propio; se aísla via JOIN con inspections.
ALTER TABLE inspection_damage_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_inspection_damage_points" ON inspection_damage_points
  FOR SELECT USING (
    inspection_id IN (
      SELECT id FROM inspections WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "tenant_insert_inspection_damage_points" ON inspection_damage_points
  FOR INSERT WITH CHECK (
    inspection_id IN (
      SELECT id FROM inspections WHERE tenant_id = get_my_tenant_id()
    )
  );

-- ─── audit_logs ──────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_audit_logs" ON audit_logs
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());


-- ═══════════════════════════════════════════════════════════════════════════════
-- C. inspection_photos – COLUMNA tenant_id + RLS
-- (La tabla la crea Prisma sin tenant_id; la agregamos aquí)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE inspection_photos
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection ON inspection_photos(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_tenant     ON inspection_photos(tenant_id);

ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_inspection_photos" ON inspection_photos
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_inspection_photos" ON inspection_photos
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_delete_inspection_photos" ON inspection_photos
  FOR DELETE USING (tenant_id = get_my_tenant_id());


-- ═══════════════════════════════════════════════════════════════════════════════
-- D. vehicle_photos – TABLA COMPLETA + RLS
-- (No está en el schema de Prisma; se crea directamente aquí)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehicle_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL,
  storage_path TEXT        NOT NULL,
  angle        TEXT,       -- 'front' | 'rear' | 'left' | 'right' | 'interior' | 'other'
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_tenant  ON vehicle_photos(tenant_id);

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_vehicle_photos" ON vehicle_photos
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_vehicle_photos" ON vehicle_photos
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_vehicle_photos" ON vehicle_photos
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_delete_vehicle_photos" ON vehicle_photos
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicle_photos_updated_at
  BEFORE UPDATE ON vehicle_photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- E. STORAGE – BUCKETS Y POLÍTICAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Bucket: inspection-photos ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-photos',
  'inspection-photos',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "inspection_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

CREATE POLICY "inspection_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

CREATE POLICY "inspection_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

-- ─── Bucket: vehicle-photos ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vehicle_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

CREATE POLICY "vehicle_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

CREATE POLICY "vehicle_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );


-- ─── Bucket: contracts ───────────────────────────────────────────────────────
-- Almacena PDFs de contratos generados (para futura integración de guardado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contracts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

CREATE POLICY "contracts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

CREATE POLICY "contracts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );


-- =============================================================================
-- FIN DEL SETUP
-- =============================================================================
-- Para verificar que todo quedó bien:
--
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' ORDER BY tablename;
--
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename, policyname;
--
-- SELECT id, name, public FROM storage.buckets WHERE id IN ('inspection-photos','vehicle-photos');
