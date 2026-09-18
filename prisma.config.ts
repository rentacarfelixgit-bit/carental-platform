import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// El CLI de Prisma solo carga ".env" por defecto; este proyecto usa ".env.local" (convención Next.js).
loadEnv({ path: path.join(__dirname, ".env.local") });

// DIRECT_URL: conexión directa (sin PgBouncer) para migraciones locales.
// En Vercel (prisma generate durante postinstall) no hay conexión a BD — se usa DATABASE_URL como fallback.
const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: dbUrl,
  },
});
