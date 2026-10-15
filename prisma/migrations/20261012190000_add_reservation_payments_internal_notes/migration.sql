-- Notas internas y abonos (efectivo / tarjeta) capturados en la reserva
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "internal_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "cash_payment"   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "card_payment"   DECIMAL(10,2);
