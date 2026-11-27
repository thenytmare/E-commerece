/**
 * Runs against a real Postgres. Skipped unless DB_INTEGRATION=1, because CI
 * has no database service. Run locally with a throwaway database:
 *   DB_INTEGRATION=1 pnpm --filter @repo/database test
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../client';
import { JobRepository, enqueueJob } from './job.repository';
import { RateLimitRepository } from './rate-limit.repository';

const run = process.env.DB_INTEGRATION === '1';
const tag = `itest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const type = `${tag}.job`;

afterAll(async () => {
  if (!run) return;
  await prisma.job.deleteMany({ where: { type: { startsWith: tag } } });
  await prisma.siteSetting.deleteMany({ where: { key: { startsWith: tag } } });
  await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: tag } } });
});

describe.skipIf(!run)('jobs (real database)', () => {
  const jobs = new JobRepository(prisma);

  it('a job queued in a transaction disappears when the transaction fails', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.siteSetting.create({ data: { key: `${tag}:order`, value: { placed: true } } });
        await enqueueJob(tx, { type, payload: { n: 1 }, uniqueKey: `${tag}:rollback` });
        throw new Error('order failed');
      })
    ).rejects.toThrow('order failed');

    expect(await prisma.job.count({ where: { uniqueKey: `${tag}:rollback` } })).toBe(0);
    expect(await prisma.siteSetting.count({ where: { key: `${tag}:order` } })).toBe(0);
  });

  it('the same unique key is queued only once', async () => {
    expect(await jobs.enqueue({ type, uniqueKey: `${tag}:dup` })).toBe(true);
    expect(await jobs.enqueue({ type, uniqueKey: `${tag}:dup` })).toBe(false);
    expect(await prisma.job.count({ where: { uniqueKey: `${tag}:dup` } })).toBe(1);
  });

  it('two workers never take the same job', async () => {
    const t = `${tag}.race`;
    for (let i = 0; i < 30; i++) await jobs.enqueue({ type: t, payload: { i } });

    const taken: string[] = [];
    // Both workers claim at the same moment, several rounds.
    for (let round = 0; round < 4; round++) {
      const [a, b] = await Promise.all([jobs.claim(`${tag}-w1`, 5), jobs.claim(`${tag}-w2`, 5)]);
      taken.push(...a.filter((j) => j.type === t).map((j) => j.id), ...b.filter((j) => j.type === t).map((j) => j.id));
    }
    expect(new Set(taken).size).toBe(taken.length);
    // Release everything this test took so other tests are not affected.
    await prisma.job.updateMany({ where: { type: t }, data: { status: 'DONE' } });
  });

  it('retries with backoff, then fails for good and keeps the error', async () => {
    const t = `${tag}.retry`;
    await jobs.enqueue({ type: t, payload: { secret: 'reset-link' }, maxAttempts: 2 });

    const first = (await jobs.claim(`${tag}-w`, 50)).find((j) => j.type === t)!;
    expect(first.attempts).toBe(1);
    expect(await jobs.fail(first, `${tag}-w`, new Error('mail down'))).toBe('retry');
    const waiting = await prisma.job.findUniqueOrThrow({ where: { id: first.id } });
    expect(waiting.status).toBe('PENDING');
    expect(waiting.runAt.getTime()).toBeGreaterThan(Date.now() + 15_000);

    // Make it due now and try again.
    await prisma.job.update({ where: { id: first.id }, data: { runAt: new Date(Date.now() - 1000) } });
    const second = (await jobs.claim(`${tag}-w`, 50)).find((j) => j.id === first.id)!;
    expect(second.attempts).toBe(2);
    expect(await jobs.fail(second, `${tag}-w`, new Error('mail down'), { scrubPayload: true })).toBe('failed');

    const failed = await prisma.job.findUniqueOrThrow({ where: { id: first.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.lastError).toBe('mail down');
    expect(failed.payload).toEqual({});
  });

  it('only the worker holding a job can complete it, and completing clears the payload', async () => {
    const t = `${tag}.complete`;
    await jobs.enqueue({ type: t, payload: { secret: 'x' } });
    const job = (await jobs.claim(`${tag}-owner`, 50)).find((j) => j.type === t)!;
    expect(await jobs.complete(job.id, `${tag}-someone-else`)).toBe(false);
    expect(await jobs.complete(job.id, `${tag}-owner`)).toBe(true);
    const done = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(done.status).toBe('DONE');
    expect(done.payload).toEqual({});
  });

  it('puts back jobs held by a stopped worker', async () => {
    const t = `${tag}.stale`;
    await jobs.enqueue({ type: t, maxAttempts: 3 });
    await jobs.enqueue({ type: t, maxAttempts: 1, payload: { secret: 'x' } });
    const claimed = (await jobs.claim(`${tag}-dead`, 50)).filter((j) => j.type === t);
    expect(claimed).toHaveLength(2);
    await prisma.job.updateMany({ where: { type: t }, data: { lockedAt: new Date(Date.now() - 10 * 60_000) } });

    expect(await jobs.releaseStale(5 * 60_000, [t])).toBeGreaterThanOrEqual(2);
    const rows = await prisma.job.findMany({ where: { type: t }, orderBy: { maxAttempts: 'asc' } });
    expect(rows[0]!.status).toBe('FAILED'); // out of attempts
    expect(rows[0]!.payload).toEqual({});
    expect(rows[1]!.status).toBe('PENDING'); // goes round again
    expect(rows[1]!.lockedBy).toBeNull();
  });

  it('reports counts, the oldest waiting job and recent failures', async () => {
    const t = `${tag}.stats`;
    await prisma.job.create({ data: { type: t, runAt: new Date(Date.now() - 120_000) } });
    const stats = await jobs.stats();
    expect(stats.counts.PENDING).toBeGreaterThanOrEqual(1);
    expect(stats.oldestPendingSeconds).toBeGreaterThanOrEqual(119);
    expect(stats.recentFailures.some((f) => f.type === `${tag}.retry`)).toBe(true);
    expect(Object.keys(stats.recentFailures[0]!)).not.toContain('payload');
  });
});

describe.skipIf(!run)('shared rate limiter (real database)', () => {
  it('two app instances share one count', async () => {
    // Two repository objects stand in for two app servers. They share only
    // the database, and fire at the same moment over several connections.
    const serverA = new RateLimitRepository(prisma);
    const serverB = new RateLimitRepository(prisma);
    const key = `${tag}:login:1.2.3.4`;

    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => (i % 2 ? serverA : serverB).hit(key, 20, 60_000))
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    const blocked = results.find((r) => !r.allowed)!;
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('starts a new window once the old one ends', async () => {
    const limiter = new RateLimitRepository(prisma);
    const key = `${tag}:window`;
    expect((await limiter.hit(key, 1, 60_000)).allowed).toBe(true);
    expect((await limiter.hit(key, 1, 60_000)).allowed).toBe(false);
    await prisma.rateLimitBucket.update({ where: { key }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await limiter.hit(key, 1, 60_000)).allowed).toBe(true);
    expect(await limiter.pruneExpired()).toBeGreaterThanOrEqual(0);
  });
});
