import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// El CLI de Prisma solo carga ".env" por defecto; este proyecto usa ".env.local" (convención Next.js).
loadEnv({ path: path.join(__dirname, ".env.local") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    // Conexión directa (sin PgBouncer) — requerida por Migrate/Introspect.
    url: env("DIRECT_URL"),
  },
});
