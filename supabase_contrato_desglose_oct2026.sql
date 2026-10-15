-- ═══════════════════════════════════════════════════════════════════════════
-- Contrato fiel a la reserva — desglose de precios y datos de "Preparar contrato"
-- Ejecutar completo en Supabase → SQL Editor. Es idempotente: se puede correr varias veces.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Desglose exacto de seguros, extras, impuestos y "Otros" que se eligieron en la reserva
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS price_breakdown      jsonb;

-- 2. Datos nuevos del modal "Preparar contrato"
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS prepared_by          text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_deductible numeric(10,2);

-- 3. Columnas del contrato que el sistema ya usa (por si alguna nunca se creó en esta base)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS folio                      text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS approval_number            text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS additional_driver_name     text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS additional_driver_license  text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS additional_driver_phone    text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS additional_driver2_name    text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS additional_driver2_license text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS additional_driver2_phone   text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS driver_age                 integer;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS client_has_pets            boolean DEFAULT false;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS daily_rate                 numeric(10,2);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS cash_payment               numeric(10,2);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS card_payment               numeric(10,2);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_cdw_accepted     boolean;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_cdw_price        numeric(10,2);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_lia_accepted     boolean;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_lia_price        numeric(10,2);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_tw_accepted      boolean;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_tw_price         numeric(10,2);
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_at_accepted      boolean;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS insurance_at_price         numeric(10,2);
ALTER TABLE public.clients      ADD COLUMN IF NOT EXISTS local_phone                text;
ALTER TABLE public.clients      ADD COLUMN IF NOT EXISTS local_address              text;

-- Que PostgREST vea las columnas nuevas de inmediato
NOTIFY pgrst, 'reload schema';

-- ── Verificación: todas deben salir "true" ─────────────────────────────────
SELECT c.col, EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col
) AS existe
FROM (VALUES
  ('reservations','price_breakdown'), ('reservations','prepared_by'), ('reservations','insurance_deductible'),
  ('reservations','folio'), ('reservations','approval_number'), ('reservations','additional_driver_license'),
  ('reservations','additional_driver2_license'), ('reservations','driver_age'), ('reservations','client_has_pets'),
  ('clients','local_phone'), ('clients','local_address')
) AS c(tbl, col);
