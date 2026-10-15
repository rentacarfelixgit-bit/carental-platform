-- Desglose de precios y datos de "Preparar contrato"
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "price_breakdown" JSONB;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "prepared_by" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "insurance_deductible" DECIMAL(10,2);
