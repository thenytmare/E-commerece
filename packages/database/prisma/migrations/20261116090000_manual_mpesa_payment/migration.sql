-- Manual M-Pesa Paybill payments: customers pay to a Paybill and submit the
-- confirmation code, which a staff member verifies by hand before the order is
-- confirmed. Used until a real payment gateway is integrated.

-- AlterEnum: a new payment status for "code submitted, awaiting staff check".
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING_CONFIRMATION';

-- AlterEnum: a new provider for the manual Paybill flow.
ALTER TYPE "PaymentProvider" ADD VALUE 'MANUAL_MPESA';
