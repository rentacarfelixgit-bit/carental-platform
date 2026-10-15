-- Permite registrar pagos mixtos (efectivo + tarjeta) en reservas
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'mixed';
