-- AlterTable
-- Idempotente: estas columnas ya se agregaron manualmente en Supabase (2026-10-08).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "passport_number" TEXT,
ADD COLUMN IF NOT EXISTS "passport_expiry" DATE;
