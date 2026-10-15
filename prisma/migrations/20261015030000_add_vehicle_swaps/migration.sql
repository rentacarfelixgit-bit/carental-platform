-- Cambio de vehículo durante una renta: se recibe el vehículo actual (inspección de recepción)
-- y se entrega el nuevo (inspección de entrega). El precio cambia desde el día del cambio,
-- salvo que el cambio sea por falla del vehículo o porque el reservado no estaba disponible.

-- CreateEnum
CREATE TYPE "vehicle_swap_reason" AS ENUM ('customer_request', 'vehicle_issue', 'unavailable');
CREATE TYPE "vehicle_swap_status" AS ENUM ('in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "reservation_vehicle_swaps" (
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
CREATE INDEX "reservation_vehicle_swaps_reservation_id_idx" ON "reservation_vehicle_swaps"("reservation_id");
-- Solo un cambio en proceso por renta
CREATE UNIQUE INDEX "reservation_vehicle_swaps_one_open" ON "reservation_vehicle_swaps"("reservation_id") WHERE "status" = 'in_progress';

ALTER TABLE "reservation_vehicle_swaps" ADD CONSTRAINT "reservation_vehicle_swaps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_vehicle_swaps" ADD CONSTRAINT "reservation_vehicle_swaps_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_vehicle_swaps" ADD CONSTRAINT "reservation_vehicle_swaps_from_vehicle_id_fkey" FOREIGN KEY ("from_vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_vehicle_swaps" ADD CONSTRAINT "reservation_vehicle_swaps_to_vehicle_id_fkey" FOREIGN KEY ("to_vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_vehicle_swaps" ADD CONSTRAINT "reservation_vehicle_swaps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inspecciones: ahora saben de qué vehículo son y si pertenecen a un cambio
ALTER TABLE "inspections" ADD COLUMN "vehicle_id" UUID;
ALTER TABLE "inspections" ADD COLUMN "swap_id" UUID;

UPDATE "inspections" i SET "vehicle_id" = r."vehicle_id"
FROM "reservations" r WHERE r."id" = i."reservation_id" AND i."vehicle_id" IS NULL;

ALTER TABLE "inspections" ADD CONSTRAINT "inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_swap_id_fkey" FOREIGN KEY ("swap_id") REFERENCES "reservation_vehicle_swaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La renta conserva una sola salida y un solo regreso "principales";
-- cada cambio de vehículo tiene su propia recepción y entrega.
DROP INDEX "inspections_reservation_id_type_key";
CREATE UNIQUE INDEX "inspections_main_reservation_type_key" ON "inspections"("reservation_id", "type") WHERE "swap_id" IS NULL;
CREATE UNIQUE INDEX "inspections_swap_type_key" ON "inspections"("swap_id", "type") WHERE "swap_id" IS NOT NULL;
CREATE INDEX "inspections_swap_id_idx" ON "inspections"("swap_id");

-- RLS
ALTER TABLE "reservation_vehicle_swaps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_vehicle_swaps" ON "reservation_vehicle_swaps" FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_vehicle_swaps"    ON "reservation_vehicle_swaps" FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_vehicle_swaps"    ON "reservation_vehicle_swaps" FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
