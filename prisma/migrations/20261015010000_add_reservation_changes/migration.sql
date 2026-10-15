-- Historial de cambios de una renta (extensión / adelanto del regreso y, más adelante,
-- cambios de vehículo). Sirve como documentación para sustentar cargos ante reclamaciones.

-- CreateEnum
CREATE TYPE "reservation_change_type" AS ENUM ('return_date', 'vehicle_change');

-- CreateTable
CREATE TABLE "reservation_changes" (
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

-- CreateIndex
CREATE INDEX "reservation_changes_reservation_id_created_at_idx" ON "reservation_changes"("reservation_id", "created_at");
CREATE INDEX "reservation_changes_tenant_id_idx" ON "reservation_changes"("tenant_id");

-- AddForeignKey
ALTER TABLE "reservation_changes" ADD CONSTRAINT "reservation_changes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_changes" ADD CONSTRAINT "reservation_changes_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_changes" ADD CONSTRAINT "reservation_changes_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: solo lectura e inserción (el historial no se edita ni se borra)
ALTER TABLE "reservation_changes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_reservation_changes" ON "reservation_changes"
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_reservation_changes" ON "reservation_changes"
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
