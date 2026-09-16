-- =============================================================================
-- Rentflow – Migración: vehicle_photos
-- Fotos base de carrocería por vehículo (registro fotográfico permanente)
-- Aplicar en: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─── 1. TABLA ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL,
  storage_path TEXT        NOT NULL,
  angle        TEXT,         -- 'front' | 'rear' | 'left' | 'right' | 'interior' | 'other'
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. ÍNDICES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_tenant  ON vehicle_photos(tenant_id);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven fotos de su propio tenant
CREATE POLICY "tenant_select_vehicle_photos" ON vehicle_photos
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_vehicle_photos" ON vehicle_photos
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_update_vehicle_photos" ON vehicle_photos
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_delete_vehicle_photos" ON vehicle_photos
  FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ─── 4. TRIGGER updated_at ───────────────────────────────────────────────────

-- Reutiliza la función set_updated_at si ya existe en el proyecto,
-- de lo contrario la crea aquí.
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

-- =============================================================================
-- BUCKET DE STORAGE
-- Ejecutar en Supabase Dashboard → Storage → New bucket, O via SQL:
-- =============================================================================

-- Bucket privado para fotos de vehículos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  false,                          -- privado (igual que inspection-photos)
  5242880,                        -- 5 MB máx por archivo
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 5. STORAGE POLICIES ─────────────────────────────────────────────────────
-- El path de cada foto debe ser: {tenant_id}/{vehicle_id}/{filename}
-- Las políticas validan que el primer segmento del path sea el tenant_id del usuario.

-- Subir fotos
CREATE POLICY "vehicle_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

-- Ver/descargar fotos
CREATE POLICY "vehicle_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

-- Eliminar fotos
CREATE POLICY "vehicle_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = (get_my_tenant_id())::text
  );

-- =============================================================================
-- VERIFICACIÓN (opcional — ejecutar por separado para confirmar)
-- =============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'vehicle_photos' ORDER BY ordinal_position;
--
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'vehicle_photos';
--
-- SELECT * FROM storage.buckets WHERE id = 'vehicle-photos';
