-- ═══════════════════════════════════════════════════════════════════════════
-- Flotilla: la tarifa diaria es obligatoria (mayor a 0) también a nivel base de datos
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- (Declinar seguros, seguro de tarjeta, drop off, términos y rentas sin fecha de retorno
--  no requieren cambios de tablas: se guardan en el desglose de la renta y en Configuración.)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_daily_rate_required') THEN
    -- NOT VALID: no falla si hubiera vehículos viejos sin tarifa; aplica a todo lo nuevo o editado
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_daily_rate_required
      CHECK (daily_rate IS NOT NULL AND daily_rate > 0) NOT VALID;
  END IF;
END $$;

-- Vehículos activos sin tarifa (corrígelos en Flotilla o Configuración → Tarifas por vehículo)
SELECT id, brand, model, plates FROM public.vehicles WHERE daily_rate IS NULL OR daily_rate <= 0;
