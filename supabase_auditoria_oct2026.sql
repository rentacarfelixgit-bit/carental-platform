-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORÍA — registro de todos los movimientos de los usuarios
-- Ejecutar completo en Supabase → SQL Editor. Idempotente (se puede volver a correr; conviene
-- hacerlo cada vez que se agregue una tabla nueva al sistema, para que también quede auditada).
--
-- Cómo funciona
--   • Un trigger en CADA tabla de "public" registra crear / modificar / eliminar, con quién lo hizo,
--     cuándo, desde dónde y SOLO los campos que cambiaron (valor anterior → nuevo).
--   • Lo hace la base de datos: no depende de que cada pantalla "se acuerde" de registrar,
--     y no se puede saltar llamando a la API directamente.
--   • El registro es de solo-agregar: nadie puede editarlo ni borrarlo (ni desde la app ni con la
--     llave de servicio). Solo lo depura la retención automática de 2 años.
--   • Solo lo ven los administradores de cada negocio.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     uuid        NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid,                    -- usuario que hizo el movimiento (null = sistema / SQL)
  actor_name    text,                    -- copia del nombre en ese momento (se conserva si lo eliminan)
  actor_role    text,
  action        text        NOT NULL CHECK (action IN ('create', 'update', 'delete', 'status')),
  table_name    text        NOT NULL,
  record_id     text,
  record_label  text,                    -- "R-0012", "Toyota Corolla · ABC-123", "Juan Pérez"…
  parent_table  text,                    -- p. ej. una inspección o un cargo pertenecen a una renta
  parent_id     text,
  changes       jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- { campo: { "old": …, "new": … } }
  source        text,                    -- 'app' | 'servicio' | 'sistema'
  ip            text,
  user_agent    text
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_time_idx   ON public.audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_actor_idx  ON public.audit_events (tenant_id, actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_table_idx  ON public.audit_events (tenant_id, table_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_record_idx        ON public.audit_events (tenant_id, record_id);
CREATE INDEX IF NOT EXISTS audit_events_parent_idx        ON public.audit_events (tenant_id, parent_id);

-- ── 2. Funciones de apoyo ───────────────────────────────────────────────────

-- Encabezados de la petición HTTP (PostgREST); null si se ejecuta desde el SQL Editor
CREATE OR REPLACE FUNCTION public.audit_request_headers() RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN nullif(current_setting('request.headers', true), '')::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- Rol del JWT de la petición ('authenticated', 'service_role'…)
CREATE OR REPLACE FUNCTION public.audit_request_role() RETURNS text
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- Usuario de la sesión (auth.uid() de Supabase)
CREATE OR REPLACE FUNCTION public.audit_session_uid() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- Etiqueta legible del registro
CREATE OR REPLACE FUNCTION public.audit_record_label(_table text, r jsonb) RETURNS text
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN CASE _table
    WHEN 'reservations' THEN
      CASE WHEN r->>'number' IS NULL THEN NULL
           ELSE (CASE WHEN r->>'origin' = 'walk_in' THEN 'C-' ELSE 'R-' END) || lpad(r->>'number', 4, '0') END
    WHEN 'clients'       THEN r->>'full_name'
    WHEN 'users'         THEN r->>'full_name'
    WHEN 'vehicles'      THEN concat_ws(' · ', nullif(concat_ws(' ', r->>'brand', r->>'model'), ''), r->>'plates')
    WHEN 'equipment_items' THEN concat_ws(' · ', r->>'code', r->>'name')
    WHEN 'calendar_events' THEN r->>'title'
    WHEN 'tenants'       THEN r->>'name'
    WHEN 'rental_charges' THEN r->>'concept'
    WHEN 'inspections'   THEN CASE r->>'type' WHEN 'checkout' THEN 'Inspección de salida'
                                              WHEN 'checkin'  THEN 'Inspección de entrada'
                                              ELSE 'Inspección' END
    WHEN 'vehicle_maintenance_alerts' THEN coalesce(r->>'description', r->>'alert_type')
    ELSE coalesce(r->>'full_name', r->>'name', r->>'title', r->>'code', r->>'concept')
  END;
END $$;

-- ── 3. Trigger genérico ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- Campos que no aportan (cambian solos) y no se registran
  ignore_cols constant text[] := ARRAY['updated_at', 'created_at', 'search_vector'];
  j_new   jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  j_old   jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  j_row   jsonb := coalesce(j_new, j_old);
  v_changes jsonb := '{}'::jsonb;
  v_action  text;
  v_tenant  uuid;
  v_actor   uuid;
  v_source  text;
  v_name    text;
  v_role    text;
  v_parent_table text;
  v_parent_id    text;
  v_hdr   jsonb := public.audit_request_headers();
  k text; v_o jsonb; v_n jsonb; sk text;
BEGIN
  -- ¿Qué cambió?
  IF TG_OP = 'UPDATE' THEN
    FOR k, v_n IN SELECT key, value FROM jsonb_each(j_new) LOOP
      CONTINUE WHEN k = ANY (ignore_cols);
      v_o := j_old -> k;
      IF v_o IS DISTINCT FROM v_n THEN
        -- Configuración del negocio: detallar por sección (precios, moneda, impuestos…)
        IF TG_TABLE_NAME = 'tenants' AND k = 'settings'
           AND jsonb_typeof(coalesce(v_o, '{}')) = 'object' AND jsonb_typeof(coalesce(v_n, '{}')) = 'object' THEN
          FOR sk IN SELECT DISTINCT key FROM (
              SELECT key FROM jsonb_each(coalesce(v_o, '{}'))
              UNION SELECT key FROM jsonb_each(coalesce(v_n, '{}'))) s LOOP
            IF (v_o -> sk) IS DISTINCT FROM (v_n -> sk) THEN
              v_changes := v_changes || jsonb_build_object('settings.' || sk,
                jsonb_build_object('old', v_o -> sk, 'new', v_n -> sk));
            END IF;
          END LOOP;
        ELSE
          v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_o, 'new', v_n));
        END IF;
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NULL; END IF;   -- nada relevante cambió
    v_action := CASE WHEN v_changes ? 'status' THEN 'status' ELSE 'update' END;
  ELSE
    FOR k, v_n IN SELECT key, value FROM jsonb_each(j_row) LOOP
      CONTINUE WHEN k = ANY (ignore_cols) OR k IN ('id', 'tenant_id') OR v_n IS NULL OR v_n = 'null'::jsonb;
      v_changes := v_changes || jsonb_build_object(k,
        CASE WHEN TG_OP = 'INSERT' THEN jsonb_build_object('new', v_n) ELSE jsonb_build_object('old', v_n) END);
    END LOOP;
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'delete' END;
  END IF;

  -- ¿A qué renta / vehículo / cliente pertenece? (para el historial de cada registro)
  IF TG_TABLE_NAME NOT IN ('reservations', 'vehicles', 'clients') THEN
    IF j_row ? 'reservation_id' AND j_row->>'reservation_id' IS NOT NULL THEN
      v_parent_table := 'reservations'; v_parent_id := j_row->>'reservation_id';
    ELSIF j_row ? 'inspection_id' AND j_row->>'inspection_id' IS NOT NULL THEN
      SELECT 'reservations', i.reservation_id::text INTO v_parent_table, v_parent_id
        FROM public.inspections i WHERE i.id::text = j_row->>'inspection_id';
    ELSIF j_row ? 'vehicle_id' AND j_row->>'vehicle_id' IS NOT NULL THEN
      v_parent_table := 'vehicles'; v_parent_id := j_row->>'vehicle_id';
    ELSIF j_row ? 'client_id' AND j_row->>'client_id' IS NOT NULL THEN
      v_parent_table := 'clients'; v_parent_id := j_row->>'client_id';
    END IF;
  END IF;

  -- Negocio (tenant) del registro
  IF TG_TABLE_NAME = 'tenants' THEN
    v_tenant := (j_row->>'id')::uuid;
  ELSIF j_row ? 'tenant_id' AND j_row->>'tenant_id' IS NOT NULL THEN
    v_tenant := (j_row->>'tenant_id')::uuid;
  ELSIF v_parent_table = 'reservations' THEN
    SELECT r.tenant_id INTO v_tenant FROM public.reservations r WHERE r.id::text = v_parent_id;
  ELSIF v_parent_table = 'vehicles' THEN
    SELECT v.tenant_id INTO v_tenant FROM public.vehicles v WHERE v.id::text = v_parent_id;
  ELSIF v_parent_table = 'clients' THEN
    SELECT c.tenant_id INTO v_tenant FROM public.clients c WHERE c.id::text = v_parent_id;
  END IF;
  IF v_tenant IS NULL THEN RETURN NULL; END IF;  -- sin negocio identificable (no debería pasar)

  -- ¿Quién? Sesión del usuario; si la app usa la llave de servicio, manda el usuario real en x-actor-id
  v_actor := public.audit_session_uid();
  IF v_actor IS NOT NULL AND public.audit_request_role() IS DISTINCT FROM 'service_role' THEN
    v_source := 'app';
  ELSE
    v_actor := NULL;
    IF public.audit_request_role() = 'service_role' THEN
      BEGIN v_actor := nullif(v_hdr ->> 'x-actor-id', '')::uuid; EXCEPTION WHEN others THEN v_actor := NULL; END;
      v_source := 'servicio';
    ELSE
      v_source := 'sistema';   -- SQL Editor, tareas programadas
    END IF;
  END IF;
  IF v_actor IS NOT NULL THEN
    SELECT u.full_name, u.role::text INTO v_name, v_role FROM public.users u WHERE u.id = v_actor;
  END IF;

  INSERT INTO public.audit_events
    (tenant_id, actor_id, actor_name, actor_role, action, table_name, record_id, record_label,
     parent_table, parent_id, changes, source, ip, user_agent)
  VALUES
    (v_tenant, v_actor, v_name, v_role, v_action, TG_TABLE_NAME, j_row->>'id',
     public.audit_record_label(TG_TABLE_NAME, j_row),
     v_parent_table, v_parent_id, v_changes, v_source,
     left(coalesce(v_hdr->>'x-audit-ip', split_part(v_hdr->>'x-forwarded-for', ',', 1)), 64),
     left(coalesce(v_hdr->>'x-audit-ua', v_hdr->>'user-agent'), 300));
  RETURN NULL;
EXCEPTION WHEN others THEN
  -- La auditoría nunca debe impedir que el usuario trabaje: si algo falla, se avisa en el log de Postgres
  RAISE WARNING 'audit_capture(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END $$;

-- ── 4. Solo-agregar: nadie edita ni borra la auditoría ──────────────────────
CREATE OR REPLACE FUNCTION public.audit_block_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('audit.purging', true) = 'on' THEN
    RETURN OLD;   -- solo la depuración automática de 2 años
  END IF;
  RAISE EXCEPTION 'La auditoría no se puede modificar ni borrar.';
END $$;

DROP TRIGGER IF EXISTS audit_events_no_update ON public.audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_block_changes();
DROP TRIGGER IF EXISTS audit_events_no_truncate ON public.audit_events;
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON public.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_block_changes();

-- ── 5. Retención: 2 años ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_purge(_days integer DEFAULT 730) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('audit.purging', 'on', true);
  DELETE FROM public.audit_events WHERE occurred_at < now() - make_interval(days => greatest(_days, 365));
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('audit.purging', 'off', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.audit_purge(integer) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.audit_purge(integer) FROM anon, authenticated';
  END IF;
END $$;

-- Programar la depuración diaria (3:15 a. m. UTC) con pg_cron, si está disponible
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'pg_cron no disponible: actívalo en Supabase → Database → Extensions y vuelve a correr este script.';
  END;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'audit-purge';
    PERFORM cron.schedule('audit-purge', '15 3 * * *', 'SELECT public.audit_purge(730)');
  END IF;
END $$;

-- ── 6. Permisos: solo administradores del negocio pueden leer ───────────────
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admins_read" ON public.audit_events;
CREATE POLICY "audit_admins_read" ON public.audit_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = public.audit_session_uid()
      AND u.tenant_id = audit_events.tenant_id
      AND u.role::text IN ('admin', 'superadmin')
      AND coalesce(u.active, true)
  )
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_events FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.audit_events TO authenticated';
  END IF;
END $$;

-- ── 7. Conectar el trigger a TODAS las tablas de "public" ───────────────────
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN ('audit_events', 'audit_logs', '_prisma_migrations')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_audit ON public.%I', t.relname);
    EXECUTE format('CREATE TRIGGER zz_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_capture()', t.relname);
    RAISE NOTICE 'Auditando: %', t.relname;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'zz_audit' AND NOT tgisinternal) AS tablas_auditadas,
  to_regclass('public.audit_events') IS NOT NULL                                    AS tabla_creada,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')                     AS retencion_automatica;
