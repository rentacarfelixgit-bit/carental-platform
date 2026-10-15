-- Inventario de equipo (GPS, hotspots, sillas de bebé…) con código fijo, asignación a rentas,
-- devolución con condición y cargos adicionales documentados (para sustentar cobros).

-- CreateEnum
CREATE TYPE "equipment_type"      AS ENUM ('gps', 'hotspot', 'baby_seat', 'other');
CREATE TYPE "equipment_status"    AS ENUM ('available', 'assigned', 'maintenance', 'lost', 'retired');
CREATE TYPE "equipment_condition" AS ENUM ('ok', 'damaged', 'missing');

-- CreateTable: catálogo
CREATE TABLE "equipment_items" (
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
CREATE UNIQUE INDEX "equipment_items_tenant_id_code_key" ON "equipment_items"("tenant_id", "code");
CREATE INDEX "equipment_items_tenant_id_status_idx" ON "equipment_items"("tenant_id", "status");

-- CreateTable: equipo entregado en una renta
CREATE TABLE "rental_equipment" (
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
CREATE INDEX "rental_equipment_reservation_id_idx" ON "rental_equipment"("reservation_id");
CREATE INDEX "rental_equipment_equipment_id_idx" ON "rental_equipment"("equipment_id");
-- Un equipo no puede estar entregado (sin devolver) en dos rentas a la vez
CREATE UNIQUE INDEX "rental_equipment_one_open_per_item" ON "rental_equipment"("equipment_id") WHERE "returned_at" IS NULL;

-- CreateTable: cargos adicionales de una renta (equipo dañado / no devuelto, u otros)
CREATE TABLE "rental_charges" (
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
CREATE INDEX "rental_charges_reservation_id_idx" ON "rental_charges"("reservation_id");

-- Enlace evento de agenda ↔ equipo entregado (recordatorio de recolección)
ALTER TABLE "calendar_events" ADD COLUMN "rental_equipment_id" UUID;

-- AddForeignKey
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_rental_equipment_id_fkey" FOREIGN KEY ("rental_equipment_id") REFERENCES "rental_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_rental_equipment_id_fkey" FOREIGN KEY ("rental_equipment_id") REFERENCES "rental_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "equipment_items"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rental_charges"   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_equipment_items" ON "equipment_items" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_equipment_items"    ON "equipment_items" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_equipment_items"    ON "equipment_items" FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_isolation_rental_equipment" ON "rental_equipment" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_rental_equipment"    ON "rental_equipment" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_rental_equipment"    ON "rental_equipment" FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_delete_rental_equipment"    ON "rental_equipment" FOR DELETE USING (tenant_id = get_my_tenant_id());

-- Los cargos son documentación: se crean y se leen, no se editan ni se borran
CREATE POLICY "tenant_isolation_rental_charges" ON "rental_charges" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_rental_charges"    ON "rental_charges" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
