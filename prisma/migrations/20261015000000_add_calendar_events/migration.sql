-- Eventos de agenda del calendario (fase 1): retornos programados, retorno de equipo,
-- cambio de vehículo, notas para el equipo y otros. Opcionalmente ligados a una renta.

-- CreateEnum
CREATE TYPE "calendar_event_type" AS ENUM ('scheduled_return', 'equipment_return', 'vehicle_change', 'team_note', 'other');

-- CreateTable
CREATE TABLE "calendar_events" (
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

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_event_date_idx" ON "calendar_events"("tenant_id", "event_date");
CREATE INDEX "calendar_events_reservation_id_idx" ON "calendar_events"("reservation_id");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_done_by_fkey"
  FOREIGN KEY ("done_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: cada empresa solo ve y modifica sus eventos
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_calendar_events" ON "calendar_events"
  FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_insert_calendar_events" ON "calendar_events"
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_update_calendar_events" ON "calendar_events"
  FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "tenant_delete_calendar_events" ON "calendar_events"
  FOR DELETE USING (tenant_id = get_my_tenant_id());
