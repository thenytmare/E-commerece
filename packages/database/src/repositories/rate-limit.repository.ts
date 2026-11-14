import { BaseRepository } from './base.repository';

export interface RateLimitHit {
  allowed: boolean;
  /** Seconds until the caller may retry. Zero when allowed. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limit counters shared by every app instance.
 *
 * One statement does the whole check: a new key starts at 1, a live window
 * adds 1, an expired window starts again at 1. Two instances hitting the same
 * key at the same moment are serialised by the row lock, so neither count is
 * lost. Uses the database clock in UTC, so app servers need not agree on time.
 */
export class RateLimitRepository extends BaseRepository {
  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitHit> {
    const rows = await this.db.$queryRaw<{ count: number; retry_after: number }[]>`
      INSERT INTO "rate_limit_buckets" ("key", "count", "reset_at")
      VALUES (${key}, 1, timezone('UTC', now()) + (${windowMs} * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limit_buckets"."reset_at" <= timezone('UTC', now())
                       THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
        "reset_at" = CASE WHEN "rate_limit_buckets"."reset_at" <= timezone('UTC', now())
                          THEN EXCLUDED."reset_at" ELSE "rate_limit_buckets"."reset_at" END
      RETURNING "count",
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("reset_at" - timezone('UTC', now())))))::int AS retry_after
    `;
    const row = rows[0];
    if (!row) return { allowed: true, retryAfterSeconds: 0 };
    return row.count > limit
      ? { allowed: false, retryAfterSeconds: row.retry_after }
      : { allowed: true, retryAfterSeconds: 0 };
  }

  /** Remove windows that ended. Keeps the table small. */
  async pruneExpired(): Promise<number> {
    return this.db.$executeRaw`
      DELETE FROM "rate_limit_buckets" WHERE "reset_at" < timezone('UTC', now())
    `;
  }
}
