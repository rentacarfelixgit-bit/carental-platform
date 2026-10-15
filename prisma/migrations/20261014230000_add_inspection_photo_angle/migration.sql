-- Ángulo de cada foto de inspección (mismos valores que vehicle_photos.angle).
-- Las fotos ya existentes quedan con angle NULL.
ALTER TABLE "inspection_photos" ADD COLUMN "angle" TEXT;

ALTER TABLE "inspection_photos"
  ADD CONSTRAINT "inspection_photos_angle_check"
  CHECK ("angle" IS NULL OR "angle" IN ('front', 'rear', 'left', 'right', 'interior', 'other'));
