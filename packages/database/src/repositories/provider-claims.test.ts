import { describe, expect, it, vi } from 'vitest';
import { PaymentRepository } from './payment.repository';
import { SiteSettingRepository } from './site-setting.repository';

describe('provider query claim and job lease', () => {
  it('claimProviderQuery is true only when exactly one row was stamped', async () => {
    const db = { $executeRaw: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) };
    const repo = new PaymentRepository(db as never);
    expect(await repo.claimProviderQuery('p1', 15_000)).toBe(true);
    expect(await repo.claimProviderQuery('p1', 15_000)).toBe(false);
  });

  it('acquireLease is true only when the lease row was taken', async () => {
    const db = { $executeRaw: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) };
    const repo = new SiteSettingRepository(db as never);
    expect(await repo.acquireLease('reconcile', 60_000)).toBe(true);
    expect(await repo.acquireLease('reconcile', 60_000)).toBe(false);
  });
});
