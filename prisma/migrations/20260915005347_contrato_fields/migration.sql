-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'card');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "phone_2" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- AlterTable
ALTER TABLE "reservation_extras" ADD COLUMN     "price_per_day" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "additional_driver2_license" TEXT,
ADD COLUMN     "additional_driver2_name" TEXT,
ADD COLUMN     "additional_driver2_phone" TEXT,
ADD COLUMN     "additional_driver_license" TEXT,
ADD COLUMN     "additional_driver_name" TEXT,
ADD COLUMN     "additional_driver_phone" TEXT,
ADD COLUMN     "airport_fee" DECIMAL(10,2),
ADD COLUMN     "approval_number" TEXT,
ADD COLUMN     "client_has_pets" BOOLEAN DEFAULT false,
ADD COLUMN     "daily_rate" DECIMAL(10,2),
ADD COLUMN     "deposit" DECIMAL(10,2),
ADD COLUMN     "discount" DECIMAL(10,2),
ADD COLUMN     "driver_age" INTEGER,
ADD COLUMN     "exchange_rate" DECIMAL(10,4),
ADD COLUMN     "folio" TEXT,
ADD COLUMN     "insurance_at_accepted" BOOLEAN,
ADD COLUMN     "insurance_at_price" DECIMAL(10,2),
ADD COLUMN     "insurance_cdw_accepted" BOOLEAN,
ADD COLUMN     "insurance_cdw_price" DECIMAL(10,2),
ADD COLUMN     "insurance_lia_accepted" BOOLEAN,
ADD COLUMN     "insurance_lia_price" DECIMAL(10,2),
ADD COLUMN     "insurance_tw_accepted" BOOLEAN,
ADD COLUMN     "insurance_tw_price" DECIMAL(10,2),
ADD COLUMN     "itbis" DECIMAL(5,2),
ADD COLUMN     "local_address" TEXT,
ADD COLUMN     "payment_method" "payment_method",
ADD COLUMN     "replacement_vehicle_id" UUID,
ADD COLUMN     "station" TEXT;
