-- ═══════════════════════════════════════════════════════════════════════════════
-- Rentflow · Cambios de octubre 2026 · Script único para el SQL Editor de Supabase
-- IDEMPOTENTE: se puede ejecutar completo aunque ya se hayan aplicado algunas partes;
-- lo que ya existe se omite. Ejecutar de una sola vez (botón Run).
--
--  1. Pago mixto                      5. Agenda del calendario
--  2. Abonos y notas internas         6. Historial de cambios de la renta
--  3. Contratos + folios R-/C-        7. Inventario de equipo y cargos
--  4. Ángulo en fotos de inspección   8. Cambio de vehículo
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: crear un enum solo si no existe
CREATE OR REPLACE FUNCTION pg_temp.create_enum(_name text, _labels text[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = _name) THEN
    EXECUTE format('CREATE TYPE %I AS ENUM (%s)', _name,
      (SELECT string_agg(quote_literal(l), ', ') FROM unnest(_labels) l));
  END IF;
END $$;

-- Helper: agregar una FK solo si no existe
CREATE OR REPLACE FUNCTION pg_temp.add_fk(_table text, _name text, _def text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = _name) THEN
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', _table, _name, _def);
  END IF;
END $$;


-- ─── 1. Pago mixto ────────────────────────────────────────────────────────────
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'mixed';


-- ─── 2. Abonos y notas internas ───────────────────────────────────────────────
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "internal_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "cash_payment"   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "card_payment"   DECIMAL(10,2);


-- ─── 3. Contratos de mostrador + numeración R-0001 / C-0001 ───────────────────
SELECT pg_temp.create_enum('reservation_origin', ARRAY['reservation', 'walk_in']);

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "origin" "reservation_origin" NOT NULL DEFAULT 'reservation',
  ADD COLUMN IF NOT EXISTS "number" INTEGER;

-- Numerar solo las rentas que aún no tienen número
WITH base AS (
  SELECT tenant_id, origin, COALESCE(MAX("number"), 0) AS max_n
  FROM "reservations" GROUP BY tenant_id, origin
), numbered AS (
  SELECT r.id, b.max_n + ROW_NUMBER() OVER (PARTITION BY r.tenant_id, r.origin ORDER BY r.created_at, r.id) AS rn
  FROM "reservations" r JOIN base b ON b.tenant_id = r.tenant_id AND b.origin = r.origin
  WHERE r."number" IS NULL
)
UPDATE "reservations" r SET "number" = numbered.rn FROM numbered WHERE r.id = numbered.id;

ALTER TABLE "reservations" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "reservations_tenant_id_origin_number_key"
  ON "reservations"("tenant_id", "origin", "number");

CREATE OR REPLACE FUNCTION set_reservation_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."number" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || ':' || NEW.origin::text, 0));
    SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number"
    FROM "reservations" WHERE tenant_id = NEW.tenant_id AND origin = NEW.origin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reservation_number ON "reservations";
CREATE TRIGGER trg_set_reservation_number
  BEFORE INSERT ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION set_reservation_number();


-- ─── 4. Ángulo en fotos de inspección ─────────────────────────────────────────
ALTER TABLE "inspection_photos" ADD COLUMN IF NOT EXISTS "angle" TEXT;
SELECT pg_temp.add_fk('inspection_photos', 'inspection_photos_angle_check',
  $$CHECK ("angle" IS NULL OR "angle" IN ('front','rear','left','right','interior','other'))$$);


-- ─── 5. Agenda del calendario ─────────────────────────────────────────────────
SELECT pg_temp.create_enum('calendar_event_type',
  ARRAY['scheduled_return', 'equipment_return', 'vehicle_change', 'team_note', 'other']);

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID NOT NULL,
  "type"           "calendar_event_type" NOT NULL DEFAULT 'other',
  "title"          TEXT NOT NULL,
  "notes"          TEXT,
  "event_date"     DATE NOT NULL,
  "event_time"     TIME(6),
  "reservation_id" UUID,
  "done"           BOOLEAN NOT NULL DEFAULT false,
  "done_at"        TIMESTAMPTZ(6),
  "done_by"        UUID,
  "created_by"     UUID NOT NULL,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "calendar_events_tenant_id_event_date_idx" ON "calendar_events"("tenant_id", "event_date");
CREATE INDEX IF NOT EXISTS "calendar_events_reservation_id_idx" ON "calendar_events"("reservation_id");

SELECT pg_temp.add_fk('calendar_events', 'calendar_events_tenant_id_fkey',      'FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('calendar_events', 'calendar_events_reservation_id_fkey', 'FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_fk('calendar_events', 'calendar_events_created_by_fkey',     'FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('calendar_events', 'calendar_events_done_by_fkey',        'FOREIGN KEY ("done_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE');

ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_calendar_events" ON "calendar_events";
DROP POLICY IF EXISTS "tenant_insert_calendar_events"    ON "calendar_events";
DROP POLICY IF EXISTS "tenant_update_calendar_events"    ON "calendar_events";
DROP POLICY IF EXISTS "tenant_delete_calendar_events"    ON "calendar_events";
CREATE POLICY "tenant_isolation_calendar_events" ON "calendar_events" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_calendar_events"    ON "calendar_events" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_calendar_events"    ON "calendar_events" FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_delete_calendar_events"    ON "calendar_events" FOR DELETE USING (tenant_id = get_my_tenant_id());


-- ─── 6. Historial de cambios de la renta ──────────────────────────────────────
SELECT pg_temp.create_enum('reservation_change_type', ARRAY['return_date', 'vehicle_change']);

CREATE TABLE IF NOT EXISTS "reservation_changes" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID NOT NULL,
  "reservation_id"  UUID NOT NULL,
  "type"            "reservation_change_type" NOT NULL,
  "old_end_date"    TIMESTAMPTZ(6),
  "new_end_date"    TIMESTAMPTZ(6),
  "old_total"       DECIMAL(10,2),
  "suggested_total" DECIMAL(10,2),
  "new_total"       DECIMAL(10,2),
  "reason"          TEXT,
  "details"         JSONB,
  "created_by"      UUID NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "reservation_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reservation_changes_reservation_id_created_at_idx" ON "reservation_changes"("reservation_id", "created_at");
CREATE INDEX IF NOT EXISTS "reservation_changes_tenant_id_idx" ON "reservation_changes"("tenant_id");

SELECT pg_temp.add_fk('reservation_changes', 'reservation_changes_tenant_id_fkey',      'FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('reservation_changes', 'reservation_changes_reservation_id_fkey', 'FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('reservation_changes', 'reservation_changes_created_by_fkey',     'FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

ALTER TABLE "reservation_changes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_reservation_changes" ON "reservation_changes";
DROP POLICY IF EXISTS "tenant_insert_reservation_changes"    ON "reservation_changes";
-- Solo lectura e inserción: el historial no se edita ni se borra
CREATE POLICY "tenant_isolation_reservation_changes" ON "reservation_changes" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_reservation_changes"    ON "reservation_changes" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());


-- ─── 7. Inventario de equipo y cargos adicionales ─────────────────────────────
SELECT pg_temp.create_enum('equipment_type',      ARRAY['gps', 'hotspot', 'baby_seat', 'other']);
SELECT pg_temp.create_enum('equipment_status',    ARRAY['available', 'assigned', 'maintenance', 'lost', 'retired']);
SELECT pg_temp.create_enum('equipment_condition', ARRAY['ok', 'damaged', 'missing']);

CREATE TABLE IF NOT EXISTS "equipment_items" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID NOT NULL,
  "code"       TEXT NOT NULL,
  "type"       "equipment_type" NOT NULL,
  "name"       TEXT,
  "status"     "equipment_status" NOT NULL DEFAULT 'available',
  "notes"      TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_items_tenant_id_code_key" ON "equipment_items"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "equipment_items_tenant_id_status_idx" ON "equipment_items"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "rental_equipment" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL,
  "reservation_id"   UUID NOT NULL,
  "equipment_id"     UUID NOT NULL,
  "assigned_by"      UUID NOT NULL,
  "assigned_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "returned_by"      UUID,
  "returned_at"      TIMESTAMPTZ(6),
  "return_condition" "equipment_condition",
  "return_notes"     TEXT,
  CONSTRAINT "rental_equipment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rental_equipment_reservation_id_idx" ON "rental_equipment"("reservation_id");
CREATE INDEX IF NOT EXISTS "rental_equipment_equipment_id_idx" ON "rental_equipment"("equipment_id");
-- Un equipo no puede estar entregado (sin devolver) en dos rentas a la vez
CREATE UNIQUE INDEX IF NOT EXISTS "rental_equipment_one_open_per_item" ON "rental_equipment"("equipment_id") WHERE "returned_at" IS NULL;

CREATE TABLE IF NOT EXISTS "rental_charges" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"           UUID NOT NULL,
  "reservation_id"      UUID NOT NULL,
  "rental_equipment_id" UUID,
  "concept"             TEXT NOT NULL,
  "amount"              DECIMAL(10,2) NOT NULL,
  "reason"              TEXT NOT NULL,
  "photo_paths"         TEXT[] NOT NULL DEFAULT '{}',
  "created_by"          UUID NOT NULL,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "rental_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rental_charges_amount_check" CHECK ("amount" >= 0)
);
CREATE INDEX IF NOT EXISTS "rental_charges_reservation_id_idx" ON "rental_charges"("reservation_id");

ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "rental_equipment_id" UUID;

SELECT pg_temp.add_fk('equipment_items',  'equipment_items_tenant_id_fkey',           'FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('equipment_items',  'equipment_items_created_by_fkey',          'FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_equipment', 'rental_equipment_tenant_id_fkey',          'FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_equipment', 'rental_equipment_reservation_id_fkey',     'FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_equipment', 'rental_equipment_equipment_id_fkey',       'FOREIGN KEY ("equipment_id") REFERENCES "equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_equipment', 'rental_equipment_assigned_by_fkey',        'FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_equipment', 'rental_equipment_returned_by_fkey',        'FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_charges',   'rental_charges_tenant_id_fkey',            'FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_charges',   'rental_charges_reservation_id_fkey',       'FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_charges',   'rental_charges_rental_equipment_id_fkey',  'FOREIGN KEY ("rental_equipment_id") REFERENCES "rental_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_fk('rental_charges',   'rental_charges_created_by_fkey',           'FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('calendar_events',  'calendar_events_rental_equipment_id_fkey', 'FOREIGN KEY ("rental_equipment_id") REFERENCES "rental_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE');

ALTER TABLE "equipment_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_charges"   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_equipment_items"  ON "equipment_items";
DROP POLICY IF EXISTS "tenant_insert_equipment_items"     ON "equipment_items";
DROP POLICY IF EXISTS "tenant_update_equipment_items"     ON "equipment_items";
DROP POLICY IF EXISTS "tenant_isolation_rental_equipment" ON "rental_equipment";
DROP POLICY IF EXISTS "tenant_insert_rental_equipment"    ON "rental_equipment";
DROP POLICY IF EXISTS "tenant_update_rental_equipment"    ON "rental_equipment";
DROP POLICY IF EXISTS "tenant_delete_rental_equipment"    ON "rental_equipment";
DROP POLICY IF EXISTS "tenant_isolation_rental_charges"   ON "rental_charges";
DROP POLICY IF EXISTS "tenant_insert_rental_charges"      ON "rental_charges";

CREATE POLICY "tenant_isolation_equipment_items"  ON "equipment_items"  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_equipment_items"     ON "equipment_items"  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_equipment_items"     ON "equipment_items"  FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_isolation_rental_equipment" ON "rental_equipment" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_rental_equipment"    ON "rental_equipment" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_rental_equipment"    ON "rental_equipment" FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_delete_rental_equipment"    ON "rental_equipment" FOR DELETE USING (tenant_id = get_my_tenant_id());
-- Los cargos son documentación: se crean y se leen, no se editan ni se borran
CREATE POLICY "tenant_isolation_rental_charges"   ON "rental_charges"   FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_rental_charges"      ON "rental_charges"   FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());


-- ─── 8. Cambio de vehículo ────────────────────────────────────────────────────
SELECT pg_temp.create_enum('vehicle_swap_reason', ARRAY['customer_request', 'vehicle_issue', 'unavailable']);
SELECT pg_temp.create_enum('vehicle_swap_status', ARRAY['in_progress', 'completed', 'cancelled']);

CREATE TABLE IF NOT EXISTS "reservation_vehicle_swaps" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID NOT NULL,
  "reservation_id"   UUID NOT NULL,
  "from_vehicle_id"  UUID NOT NULL,
  "to_vehicle_id"    UUID NOT NULL,
  "reason"           "vehicle_swap_reason" NOT NULL,
  "keep_price"       BOOLEAN NOT NULL DEFAULT false,
  "status"           "vehicle_swap_status" NOT NULL DEFAULT 'in_progress',
  "swap_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "days_used"        INTEGER,
  "days_remaining"   INTEGER,
  "from_daily_rate"  DECIMAL(10,2),
  "to_daily_rate"    DECIMAL(10,2),
  "old_total"        DECIMAL(10,2),
  "suggested_total"  DECIMAL(10,2),
  "new_total"        DECIMAL(10,2),
  "notes"            TEXT,
  "created_by"       UUID NOT NULL,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "completed_at"     TIMESTAMPTZ(6),
  CONSTRAINT "reservation_vehicle_swaps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reservation_vehicle_swaps_reservation_id_idx" ON "reservation_vehicle_swaps"("reservation_id");
-- Solo un cambio en proceso por renta
CREATE UNIQUE INDEX IF NOT EXISTS "reservation_vehicle_swaps_one_open" ON "reservation_vehicle_swaps"("reservation_id") WHERE "status" = 'in_progress';

SELECT pg_temp.add_fk('reservation_vehicle_swaps', 'reservation_vehicle_swaps_tenant_id_fkey',       'FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('reservation_vehicle_swaps', 'reservation_vehicle_swaps_reservation_id_fkey',  'FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_fk('reservation_vehicle_swaps', 'reservation_vehicle_swaps_from_vehicle_id_fkey', 'FOREIGN KEY ("from_vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('reservation_vehicle_swaps', 'reservation_vehicle_swaps_to_vehicle_id_fkey',   'FOREIGN KEY ("to_vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_fk('reservation_vehicle_swaps', 'reservation_vehicle_swaps_created_by_fkey',      'FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- Inspecciones: de qué vehículo son y si pertenecen a un cambio
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "vehicle_id" UUID;
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "swap_id" UUID;

UPDATE "inspections" i SET "vehicle_id" = r."vehicle_id"
FROM "reservations" r WHERE r."id" = i."reservation_id" AND i."vehicle_id" IS NULL;

SELECT pg_temp.add_fk('inspections', 'inspections_vehicle_id_fkey', 'FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_fk('inspections', 'inspections_swap_id_fkey',    'FOREIGN KEY ("swap_id") REFERENCES "reservation_vehicle_swaps"("id") ON DELETE SET NULL ON UPDATE CASCADE');

-- Una salida y un regreso "principales" por renta + una recepción y una entrega por cada cambio
DROP INDEX IF EXISTS "inspections_reservation_id_type_key";
ALTER TABLE "inspections" DROP CONSTRAINT IF EXISTS "inspections_reservation_id_type_key";
CREATE UNIQUE INDEX IF NOT EXISTS "inspections_main_reservation_type_key" ON "inspections"("reservation_id", "type") WHERE "swap_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "inspections_swap_type_key" ON "inspections"("swap_id", "type") WHERE "swap_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "inspections_swap_id_idx" ON "inspections"("swap_id");

ALTER TABLE "reservation_vehicle_swaps" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_vehicle_swaps" ON "reservation_vehicle_swaps";
DROP POLICY IF EXISTS "tenant_insert_vehicle_swaps"    ON "reservation_vehicle_swaps";
DROP POLICY IF EXISTS "tenant_update_vehicle_swaps"    ON "reservation_vehicle_swaps";
CREATE POLICY "tenant_isolation_vehicle_swaps" ON "reservation_vehicle_swaps" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_vehicle_swaps"    ON "reservation_vehicle_swaps" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_vehicle_swaps"    ON "reservation_vehicle_swaps" FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());


-- ─── Verificación: todas deben salir en true ──────────────────────────────────
SELECT 'mixed' AS cambio, EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'payment_method' AND e.enumlabel = 'mixed') AS ok
UNION ALL SELECT 'internal_notes',      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'internal_notes')
UNION ALL SELECT 'origin_number',       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'number')
UNION ALL SELECT 'photo_angle',         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspection_photos' AND column_name = 'angle')
UNION ALL SELECT 'calendar_events',     EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_name = 'calendar_events')
UNION ALL SELECT 'reservation_changes', EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_name = 'reservation_changes')
UNION ALL SELECT 'equipment',           EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_name = 'equipment_items')
UNION ALL SELECT 'vehicle_swaps',       EXISTS (SELECT 1 FROM information_schema.tables  WHERE table_name = 'reservation_vehicle_swaps');
