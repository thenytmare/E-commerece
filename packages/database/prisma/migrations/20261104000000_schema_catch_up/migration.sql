-- Catch-up migration.
--
-- The earlier migrations were missing two tables and ~30 columns that
-- schema.prisma (and the app) already use, most likely because local
-- databases were built with `prisma db push`. A database built only from the
-- migrations (as `prisma migrate deploy` does in production) broke the brand,
-- review, media and payment screens.
--
-- Written to be safe on any database:
--   * fresh (built from the migrations)      -> adds everything
--   * already has rows                        -> backfills before NOT NULL
--   * already built with `db push`            -> IF NOT EXISTS skips what's there

-- ─── New tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "back_in_stock_notifications" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "back_in_stock_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "media_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- ─── Columns ─────────────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "newsletter_subscribed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);

ALTER TABLE "brands"
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "payer_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "receipt_number" TEXT,
  ADD COLUMN IF NOT EXISTS "failure_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_verified_purchase" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "helpful_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "admin_reply" TEXT;

-- products.status: existing products keep their storefront state. Without
-- this backfill every existing product would be labelled 'draft' in admin.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE "products" ADD COLUMN "status" TEXT;
    UPDATE "products" SET "status" = CASE WHEN "is_active" THEN 'active' ELSE 'inactive' END;
    ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'draft', ALTER COLUMN "status" SET NOT NULL;
  END IF;
END $$;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- media_library: four new required columns, backfilled from existing data.
-- storage_key matches what the upload route writes (the stored filename).
ALTER TABLE "media_library"
  ADD COLUMN IF NOT EXISTS "original_filename" TEXT,
  ADD COLUMN IF NOT EXISTS "extension" TEXT,
  ADD COLUMN IF NOT EXISTS "width" INTEGER,
  ADD COLUMN IF NOT EXISTS "height" INTEGER,
  ADD COLUMN IF NOT EXISTS "storage_key" TEXT,
  ADD COLUMN IF NOT EXISTS "caption" TEXT,
  ADD COLUMN IF NOT EXISTS "folder_id" TEXT,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

UPDATE "media_library" SET "original_filename" = "filename" WHERE "original_filename" IS NULL;
UPDATE "media_library"
  SET "extension" = CASE WHEN "filename" LIKE '%.%'
                         THEN lower(regexp_replace("filename", '^.*\.', ''))
                         ELSE '' END
  WHERE "extension" IS NULL;
UPDATE "media_library" SET "storage_key" = "filename" WHERE "storage_key" IS NULL;
UPDATE "media_library" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

ALTER TABLE "media_library"
  ALTER COLUMN "original_filename" SET NOT NULL,
  ALTER COLUMN "extension" SET NOT NULL,
  ALTER COLUMN "storage_key" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_notifications_product_id_email_key" ON "back_in_stock_notifications"("product_id", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_notifications_product_id_user_id_key" ON "back_in_stock_notifications"("product_id", "user_id");
CREATE INDEX IF NOT EXISTS "media_folders_parent_id_idx" ON "media_folders"("parent_id");
CREATE INDEX IF NOT EXISTS "media_library_folder_id_idx" ON "media_library"("folder_id");
CREATE INDEX IF NOT EXISTS "media_library_mime_type_idx" ON "media_library"("mime_type");
CREATE INDEX IF NOT EXISTS "media_library_uploaded_by_idx" ON "media_library"("uploaded_by");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX IF NOT EXISTS "payments_provider_status_created_at_idx" ON "payments"("provider", "status", "created_at");
CREATE INDEX IF NOT EXISTS "payments_receipt_number_idx" ON "payments"("receipt_number");

-- ─── Foreign keys (skipped if already present) ───────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_in_stock_notifications_product_id_fkey') THEN
    ALTER TABLE "back_in_stock_notifications" ADD CONSTRAINT "back_in_stock_notifications_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_in_stock_notifications_user_id_fkey') THEN
    ALTER TABLE "back_in_stock_notifications" ADD CONSTRAINT "back_in_stock_notifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_folders_parent_id_fkey') THEN
    ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_library_folder_id_fkey') THEN
    ALTER TABLE "media_library" ADD CONSTRAINT "media_library_folder_id_fkey"
      FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_library_uploaded_by_fkey') THEN
    ALTER TABLE "media_library" ADD CONSTRAINT "media_library_uploaded_by_fkey"
      FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
