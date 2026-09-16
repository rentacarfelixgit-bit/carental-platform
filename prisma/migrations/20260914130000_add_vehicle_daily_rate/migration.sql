-- AlterTable: add daily_rate to vehicles
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "daily_rate" DECIMAL(10,2);
