-- Guest checkout: an address may now exist without an account behind it, and
-- a guest order records its own contact email since there is no user to read
-- one from.
ALTER TABLE "addresses" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_email" TEXT;
