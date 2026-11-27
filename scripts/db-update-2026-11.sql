-- Prime Accessories Kenya: database update for the November 2026 release.
--
-- Adds the three database changes the new code needs, only where they are
-- missing. Safe to run more than once: anything already there is skipped.
--   1. jobs and rate_limit_buckets tables  (20261112000000_jobs_and_rate_limits)
--   2. media_library.category_id           (20261113000000_media_categories)
--   3. orders.source_cart_id / cart_restored_at (20261114000000_checkout_recovery)
-- Each change is also recorded in Prisma's migration list, so a later
-- `prisma migrate deploy` knows it is done and will not try it again.
--
-- HOW TO USE
--   1. In Coolify, take a backup of the database first.
--   2. Open the database resource, then Terminal, and start psql
--      (psql -U <POSTGRES_USER> -d <POSTGRES_DB>).
--   3. Paste this whole file. It runs as one transaction: all of it, or none.
--   4. Check the report at the end, then run the category clean-up script.

BEGIN;

-- Prisma's own list of applied changes. Created only if missing (for example
-- if the database was first set up with `prisma db push`).
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"            VARCHAR(64) NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- 1. Background jobs and shared rate limit counters ----------------------------
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    CREATE TABLE "jobs" (
        "id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "payload" JSONB NOT NULL DEFAULT '{}',
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "max_attempts" INTEGER NOT NULL DEFAULT 5,
        "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "locked_at" TIMESTAMP(3),
        "locked_by" TEXT,
        "last_error" TEXT,
        "unique_key" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "jobs_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'DONE', 'FAILED'))
    );
    CREATE UNIQUE INDEX "jobs_unique_key_key" ON "jobs"("unique_key");
    CREATE INDEX "jobs_status_run_at_idx" ON "jobs"("status", "run_at");
    RAISE NOTICE 'Added: jobs table';
  END IF;

  IF to_regclass('public.rate_limit_buckets') IS NULL THEN
    CREATE TABLE "rate_limit_buckets" (
        "key" TEXT NOT NULL,
        "count" INTEGER NOT NULL,
        "reset_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
    );
    CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");
    RAISE NOTICE 'Added: rate_limit_buckets table';
  END IF;
END $$;

-- 2. Media library folders by category --------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'media_library' AND column_name = 'category_id') THEN
    ALTER TABLE "media_library" ADD COLUMN "category_id" TEXT;
    CREATE INDEX "media_library_category_id_idx" ON "media_library"("category_id");
    ALTER TABLE "media_library" ADD CONSTRAINT "media_library_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    RAISE NOTICE 'Added: media_library.category_id';
  END IF;
END $$;

-- 3. Checkout recovery -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'source_cart_id') THEN
    ALTER TABLE "orders" ADD COLUMN "source_cart_id" TEXT, ADD COLUMN "cart_restored_at" TIMESTAMP(3);
    CREATE INDEX "orders_source_cart_id_idx" ON "orders"("source_cart_id");
    ALTER TABLE "orders" ADD CONSTRAINT "orders_source_cart_id_fkey"
      FOREIGN KEY ("source_cart_id") REFERENCES "carts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    RAISE NOTICE 'Added: orders.source_cart_id and cart_restored_at';
  END IF;
END $$;

-- Record all three in Prisma's list (skipped where already recorded).
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, m.checksum, now(), m.name, now(), 1
FROM (VALUES
  ('20261112000000_jobs_and_rate_limits', 'b1fd38a5249693ac886d75782dfdad1341af5b222e5b8cb32c78a25ccafb2235'),
  ('20261113000000_media_categories',     'd690df86c9c91caca4e61be6953ba3e0e4162b4f1da54cd5bd499425788eef25'),
  ('20261114000000_checkout_recovery',    '30b2cbe9832e6a4347bc08df860306d7f3fa4555e623887b5e97f664329bc70e')
) AS m(name, checksum)
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations" p WHERE p.migration_name = m.name AND p.rolled_back_at IS NULL
);

COMMIT;

-- REPORT: every line should say yes.
SELECT 'jobs table'                 AS "change", (to_regclass('public.jobs') IS NOT NULL)::text AS "in place"
UNION ALL SELECT 'rate_limit_buckets table', (to_regclass('public.rate_limit_buckets') IS NOT NULL)::text
UNION ALL SELECT 'media_library.category_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media_library' AND column_name = 'category_id')::text
UNION ALL SELECT 'orders.source_cart_id',     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'source_cart_id')::text
UNION ALL SELECT 'recorded for Prisma',        (SELECT count(*) FROM "_prisma_migrations" WHERE migration_name IN
  ('20261112000000_jobs_and_rate_limits', '20261113000000_media_categories', '20261114000000_checkout_recovery') AND rolled_back_at IS NULL)::text || ' of 3';
