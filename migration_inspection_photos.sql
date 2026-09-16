-- =============================================================================
-- Rentflow – Migración: inspection_photos
-- Aplicar en: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Tabla de fotos de inspección
CREATE TABLE IF NOT EXISTS inspection_photos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  UUID        NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  tenant_id      UUID        NOT NULL REFERENCES tenants(id),
  storage_path   TEXT        NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection ON inspection_photos(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_tenant     ON inspection_photos(tenant_id);

-- RLS
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_inspection_photos" ON inspection_photos
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_insert_inspection_photos" ON inspection_photos
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_delete_inspection_photos" ON inspection_photos
  FOR DELETE USING (tenant_id = get_my_tenant_id());
