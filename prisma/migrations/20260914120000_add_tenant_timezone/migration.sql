-- AlterTable: add timezone column to tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';
