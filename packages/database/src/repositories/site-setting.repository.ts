import type { Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class SiteSettingRepository extends BaseRepository {
  async findByKey(key: string) {
    return this.db.siteSetting.findUnique({ where: { key } });
  }

  /**
   * Take a short lease so only one copy of a background job runs at a time.
   *
   * Returns true if this caller got the lease. A lease that has expired can be
   * taken over, so a crashed job never blocks the next run for longer than
   * `ttlMs`. The check and the take happen in one statement.
   */
  async acquireLease(name: string, ttlMs: number): Promise<boolean> {
    const key = `lease:${name}`;
    const changed = await this.db.$executeRaw`
      INSERT INTO "site_settings" ("id", "key", "value")
      VALUES (gen_random_uuid()::text, ${key},
              jsonb_build_object('expiresAt', (now() + (${ttlMs} * interval '1 millisecond'))::text))
      ON CONFLICT ("key") DO UPDATE
        SET "value" = jsonb_build_object('expiresAt', (now() + (${ttlMs} * interval '1 millisecond'))::text)
        WHERE ("site_settings"."value"->>'expiresAt')::timestamptz < now()
    `;
    return changed === 1;
  }

  /** Give the lease back early, so the next run need not wait for it to expire. */
  async releaseLease(name: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE "site_settings"
      SET "value" = jsonb_build_object('expiresAt', now()::text)
      WHERE "key" = ${`lease:${name}`}
    `;
  }

  async upsert(key: string, value: Prisma.InputJsonValue) {
    return this.db.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}