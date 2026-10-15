-- Contratos de mostrador (walk-in) vs reservas, y numeración consecutiva separada.
-- Una renta de mostrador ("contrato abierto") usa la misma tabla y el mismo flujo de estados
-- que una reserva; solo cambia su origen, su número y cómo se muestra.

-- CreateEnum
CREATE TYPE "reservation_origin" AS ENUM ('reservation', 'walk_in');

-- AlterTable
ALTER TABLE "reservations"
  ADD COLUMN "origin" "reservation_origin" NOT NULL DEFAULT 'reservation',
  ADD COLUMN "number" INTEGER;

-- Numerar las rentas existentes por tenant y origen, en orden de creación
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id, origin ORDER BY created_at, id) AS rn
  FROM "reservations"
)
UPDATE "reservations" r SET "number" = numbered.rn
FROM numbered WHERE r.id = numbered.id;

ALTER TABLE "reservations" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "reservations_tenant_id_origin_number_key"
  ON "reservations"("tenant_id", "origin", "number");

-- Asignar el siguiente número automáticamente al insertar (R-0001 / C-0001).
-- El advisory lock evita que dos inserciones simultáneas tomen el mismo número.
CREATE OR REPLACE FUNCTION set_reservation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."number" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || ':' || NEW.origin::text, 0));
    SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number"
    FROM "reservations"
    WHERE tenant_id = NEW.tenant_id AND origin = NEW.origin;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_reservation_number
  BEFORE INSERT ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION set_reservation_number();
