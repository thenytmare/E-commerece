-- Per-customer coupon usage cap. Nullable, so existing coupons keep their
-- previous behaviour (global limit only) until an admin sets one.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_uses_per_customer" INTEGER;
