-- ═══════════════════════════════════════════════════════════════════════════
-- Moneda: precios en US$ + tasa de cambio por renta + moneda de cada abono
-- Ejecutar completo en Supabase → SQL Editor. Idempotente (se puede correr varias veces).
-- La moneda local y la tasa del negocio se guardan en Configuración → Moneda (tenants.settings),
-- no requieren cambios de tablas.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tasa congelada de cada renta: 1 US$ = exchange_rate en moneda local
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS exchange_rate numeric(10,4);

-- Moneda en que se capturó cada abono ('USD' o el código local, p. ej. 'DOP')
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS cash_payment_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS card_payment_currency text NOT NULL DEFAULT 'USD';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_payment_currency_chk') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_payment_currency_chk
      CHECK (cash_payment_currency ~ '^[A-Z]{3}$' AND card_payment_currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Verificación: todas deben salir "true" ─────────────────────────────────
SELECT c.col, EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = c.col
) AS existe
FROM (VALUES ('exchange_rate'), ('cash_payment_currency'), ('card_payment_currency')) AS c(col);
