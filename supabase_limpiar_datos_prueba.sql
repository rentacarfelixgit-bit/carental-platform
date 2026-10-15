-- ═══════════════════════════════════════════════════════════════════════════
-- LIMPIEZA DE DATOS DE PRUEBA — deja la base lista para producción
-- ⚠ NO SE PUEDE DESHACER. Correr en Supabase → SQL Editor solo cuando estés segura.
--
-- SE BORRA: reservas y contratos, clientes y lista negra, inspecciones (fotos, daños),
--           eventos del calendario, cambios de fecha/vehículo, cargos, equipo y su historial,
--           vehículos con sus alertas y bloqueos, bitácora de auditoría.
-- SE CONSERVA: el negocio (tenants) y su Configuración (precios, impuestos, datos del negocio),
--              funciones activas (tenant_features) y los usuarios con sus accesos.
--
-- Los folios vuelven a empezar en R-0001 y C-0001 (el consecutivo se calcula del máximo existente).
-- Recomendado antes de correrlo: Supabase → Database → Backups, confirmar que hay un respaldo reciente.
-- ═══════════════════════════════════════════════════════════════════════════

-- Se borran estas tablas MÁS cualquier otra que dependa de ellas (p. ej. vehicle_photos),
-- detectadas automáticamente. Si alguna de las tablas que se conservan quedara en la lista,
-- el script se detiene sin borrar nada.
DO $$
DECLARE
  targets  text[] := ARRAY[
    'reservation_vehicle_swaps','rental_charges','rental_equipment','equipment_items',
    'reservation_changes','calendar_events','inspection_photos','inspection_damage_points',
    'inspections','contracts','reservation_extras','reservations','client_blacklist','clients',
    'vehicle_blocks','vehicle_maintenance_alerts','vehicles','audit_logs'];
  protect  text[] := ARRAY['tenants','tenant_features','users'];
  added    text[];
  t        text;
BEGIN
  -- Solo las que existen en esta base
  SELECT array_agg(x) INTO targets FROM unnest(targets) x WHERE to_regclass('public.' || x) IS NOT NULL;

  -- Agregar en cadena las tablas de "public" que tienen llaves foráneas hacia alguna de la lista
  LOOP
    SELECT array_agg(DISTINCT src.relname::text) INTO added
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_class dst ON dst.oid = c.confrelid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace AND ns.nspname = 'public'
    WHERE c.contype = 'f'
      AND dst.relname = ANY (targets)
      AND NOT (src.relname = ANY (targets));
    EXIT WHEN added IS NULL;
    targets := targets || added;
  END LOOP;

  IF targets && protect THEN
    RAISE EXCEPTION 'Se detuvo sin borrar nada: una tabla que se conserva depende de los datos (%)', targets;
  END IF;

  RAISE NOTICE 'Tablas que se vacían: %', array_to_string(targets, ', ');
  EXECUTE 'TRUNCATE TABLE ' ||
    (SELECT string_agg(format('public.%I', x), ', ') FROM unnest(targets) x) ||
    ' RESTART IDENTITY';
END $$;

-- ── Verificación: todas en 0, y tenants / users con sus registros ────────────
SELECT 'reservations' AS tabla, COUNT(*) FROM public.reservations
UNION ALL SELECT 'clients',         COUNT(*) FROM public.clients
UNION ALL SELECT 'vehicles',        COUNT(*) FROM public.vehicles
UNION ALL SELECT 'inspections',     COUNT(*) FROM public.inspections
UNION ALL SELECT 'calendar_events', COUNT(*) FROM public.calendar_events
UNION ALL SELECT 'equipment_items', COUNT(*) FROM public.equipment_items
UNION ALL SELECT '(se conserva) tenants', COUNT(*) FROM public.tenants
UNION ALL SELECT '(se conserva) users',   COUNT(*) FROM public.users;
