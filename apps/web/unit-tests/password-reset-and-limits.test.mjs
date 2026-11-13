import { afterEach, describe, expect, it, vi } from 'vitest';

describe('password reset request', () => {
  afterEach(() => vi.resetModules());

  async function load({ user }) {
    const enqueueJob = vi.fn().mockResolvedValue(true);
    const tx = {
      verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
    };
    const sendMail = vi.fn();
    vi.doMock('@repo/database', () => ({
      enqueueJob,
      prisma: { $transaction: (fn) => fn(tx) },
      createRepositories: () => ({ user: { findByEmail: async () => user } }),
    }));
    vi.doMock('@/lib/mail', () => ({ sendMail }));
    vi.doMock('@/lib/rate-limit', () => ({
      clientIdentifier: async () => '1.1.1.1',
      rateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
      retryMessage: () => '',
    }));
    const mod = await import('@/lib/actions/password-reset');
    return { mod, enqueueJob, tx, sendMail };
  }

  const form = () => {
    const f = new FormData();
    f.set('email', 'shopper@example.com');
    return f;
  };

  it('queues the email instead of sending it during the request', async () => {
    const user = { isActive: true, deletedAt: null, passwordHash: 'h' };
    const { mod, enqueueJob, tx, sendMail } = await load({ user });
    const res = await mod.requestPasswordResetAction(null, form());
    expect(res).toEqual({ success: true });
    expect(sendMail).not.toHaveBeenCalled();
    expect(tx.verificationToken.create).toHaveBeenCalledTimes(1);
    const [db, job] = enqueueJob.mock.calls[0];
    expect(db).toBe(tx); // same transaction as the token
    expect(job.type).toBe('auth.password-reset-email');
    expect(job.payload.to).toBe('shopper@example.com');
    expect(job.payload.resetUrl).toMatch(/reset-password\?token=/);
  });

  it('gives the same answer when there is no such account', async () => {
    const { mod, enqueueJob } = await load({ user: null });
    const res = await mod.requestPasswordResetAction(null, form());
    expect(res).toEqual({ success: true });
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

describe('rate limiter', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function mockStore(hit) {
    // The tests above replace the limiter itself; use the real one here.
    vi.doUnmock('@/lib/rate-limit');
    vi.doMock('next/headers', () => ({ headers: async () => new Headers() }));
    vi.doMock('@repo/database', () => ({
      createRepositories: () => ({ rateLimit: { hit, pruneExpired: async () => 0 } }),
    }));
  }

  it('uses the shared store and never stores the raw key', async () => {
    const hit = vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    mockStore(hit);
    const { rateLimit } = await import('@/lib/rate-limit');
    const res = await rateLimit('auth-account:shopper@example.com', 10, 60_000);
    expect(res).toEqual({ allowed: false, retryAfterSeconds: 42 });
    const storedKey = hit.mock.calls[0][0];
    expect(storedKey.startsWith('auth-account:')).toBe(true);
    expect(storedKey).not.toContain('shopper');
    expect(hit.mock.calls[0].slice(1)).toEqual([10, 60_000]);
  });

  it('falls back to this server\'s own counts when the database fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockStore(vi.fn().mockRejectedValue(new Error('db down')));
    const { rateLimit } = await import('@/lib/rate-limit');
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await rateLimit('login:9.9.9.9', 2, 60_000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, false]);
  });

  it('can be switched to memory only', async () => {
    process.env.RATE_LIMIT_STORE = 'memory';
    const hit = vi.fn();
    mockStore(hit);
    const { rateLimit } = await import('@/lib/rate-limit');
    await rateLimit('login:8.8.8.8', 2, 60_000);
    expect(hit).not.toHaveBeenCalled();
  });
});
