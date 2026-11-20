-- Per-location delivery pricing and Cash on Delivery.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'CASH_ON_DELIVERY';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "delivery_zone" TEXT,
ADD COLUMN "delivery_location" TEXT;
