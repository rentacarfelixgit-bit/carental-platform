-- Moneda: tasa por renta y moneda de cada abono
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(10,4);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cash_payment_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "card_payment_currency" TEXT NOT NULL DEFAULT 'USD';
