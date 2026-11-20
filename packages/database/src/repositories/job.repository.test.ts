import { describe, expect, it, vi } from 'vitest';
import { JobRepository, retryDelayMs } from './job.repository';

describe('retryDelayMs', () => {
  it('doubles from 30 seconds and stops at one hour', () => {
    const mid = () => 0.5; // no spread
    expect(retryDelayMs(1, mid)).toBe(30_000);
    expect(retryDelayMs(2, mid)).toBe(60_000);
    expect(retryDelayMs(3, mid)).toBe(120_000);
    expect(retryDelayMs(20, mid)).toBe(3_600_000);
  });

  it('spreads retries by up to 20 percent either way', () => {
    expect(retryDelayMs(1, () => 0)).toBe(24_000);
    expect(retryDelayMs(1, () => 0.999999)).toBeLessThanOrEqual(36_000);
    expect(retryDelayMs(1, () => 0.999999)).toBeGreaterThan(35_000);
  });
});

describe('JobRepository.fail', () => {
  function repoWith(changed: number) {
    const db = { $executeRaw: vi.fn().mockResolvedValue(changed) };
    return { repo: new JobRepository(db as never), db };
  }

  it('schedules a retry while attempts remain', async () => {
    const { repo, db } = repoWith(1);
    const outcome = await repo.fail({ id: 'j1', attempts: 1, maxAttempts: 5 }, 'w1', new Error('SMTP down'));
    expect(outcome).toBe('retry');
    const values = db.$executeRaw.mock.calls[0]!.slice(1);
    expect(values).toContain('PENDING');
    expect(values).toContain('SMTP down');
  });

  it('marks the job failed after the last attempt', async () => {
    const { repo, db } = repoWith(1);
    const outcome = await repo.fail({ id: 'j1', attempts: 5, maxAttempts: 5 }, 'w1', 'still down');
    expect(outcome).toBe('failed');
    expect(db.$executeRaw.mock.calls[0]!.slice(1)).toContain('FAILED');
  });

  it('reports a lost job when another worker owns it now', async () => {
    const { repo } = repoWith(0);
    expect(await repo.fail({ id: 'j1', attempts: 1, maxAttempts: 5 }, 'w1', 'x')).toBe('lost');
  });

  it('keeps long error text short', async () => {
    const { repo, db } = repoWith(1);
    await repo.fail({ id: 'j1', attempts: 1, maxAttempts: 5 }, 'w1', new Error('e'.repeat(5000)));
    const message = db.$executeRaw.mock.calls[0]!.slice(1).find((v: unknown) => typeof v === 'string' && v.startsWith('eee'));
    expect(message.length).toBeLessThanOrEqual(1003);
  });
});
