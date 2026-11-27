-- APPLIED. Approved on 12 November 2026 and now in packages/database/prisma/migrations/20261112000000_jobs_and_rate_limits.
-- Kept for the record. Apply the migration, not this file.

-- 1. Background jobs (stage 3)
CREATE TABLE "jobs" (
  "id"          TEXT         NOT NULL,
  "type"        TEXT         NOT NULL,
  "payload"     JSONB        NOT NULL DEFAULT '{}',
  "status"      TEXT         NOT NULL DEFAULT 'PENDING',  -- PENDING, RUNNING, DONE, FAILED
  "attempts"    INTEGER      NOT NULL DEFAULT 0,
  "max_attempts" INTEGER     NOT NULL DEFAULT 5,
  "run_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at"   TIMESTAMP(3),
  "locked_by"   TEXT,
  "last_error"  TEXT,
  "unique_key"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "jobs_status_check" CHECK ("status" IN ('PENDING','RUNNING','DONE','FAILED'))
);
CREATE UNIQUE INDEX "jobs_unique_key_key" ON "jobs" ("unique_key");
CREATE INDEX "jobs_status_run_at_idx" ON "jobs" ("status", "run_at");

-- 2. Shared rate limit counters (stage 4)
-- One row per key and time window. The app does an atomic
-- INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count.
CREATE TABLE "rate_limit_buckets" (
  "key"        TEXT         NOT NULL,
  "count"      INTEGER      NOT NULL,
  "reset_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets" ("reset_at");
