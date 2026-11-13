import { beforeEach, describe, expect, it, vi } from 'vitest';

// The worker and handlers only need these names from the database package.
vi.mock('@repo/database', () => ({
  prisma: {},
  createRepositories: () => ({}),
  ORDER_CONFIRMATION_JOB: 'order.confirmation-email',
  BACK_IN_STOCK_EMAIL_JOB: 'back-in-stock.email',
}));

const { runJob, scheduleSlot } = await import('@/lib/jobs/worker');
const { jobHandlers, SENSITIVE_JOB_TYPES, RETRYABLE_JOB_TYPES } = await import('@/lib/jobs/handlers');
const emails = await import('@/lib/jobs/emails');

function fakeRepos() {
  return {
    job: {
      complete: vi.fn().mockResolvedValue(true),
      fail: vi.fn().mockResolvedValue('retry'),
    },
    rateLimit: {},
  };
}

const job = { id: 'j1', type: 'test.job', payload: { a: 1 }, attempts: 1, maxAttempts: 5, uniqueKey: null };

describe('runJob', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined));

  it('marks a job done when its handler succeeds', async () => {
    const repos = fakeRepos();
    const run = vi.fn().mockResolvedValue(undefined);
    const outcome = await runJob(repos, job, { 'test.job': { run, timeoutMs: 1000, retryable: true } }, 'w1');
    expect(outcome).toBe('done');
    expect(run).toHaveBeenCalledWith({ a: 1 });
    expect(repos.job.complete).toHaveBeenCalledWith('j1', 'w1');
  });

  it('records a failure for retry and never logs the payload', async () => {
    const repos = fakeRepos();
    const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const run = vi.fn().mockRejectedValue(new Error('SMTP down'));
    const outcome = await runJob(
      repos,
      { ...job, payload: { resetUrl: 'https://x/reset?token=SECRET' } },
      { 'test.job': { run, timeoutMs: 1000, retryable: false, sensitive: true } },
      'w1'
    );
    expect(outcome).toBe('retry');
    expect(repos.job.fail.mock.calls[0][3]).toEqual({ scrubPayload: true });
    expect(logs.mock.calls.flat().join(' ')).not.toContain('SECRET');
  });

  it('fails a job whose type has no handler', async () => {
    const repos = fakeRepos();
    await runJob(repos, { ...job, type: 'nobody.handles.this' }, {}, 'w1');
    expect(repos.job.fail.mock.calls[0][2].message).toMatch(/No handler/);
    expect(repos.job.complete).not.toHaveBeenCalled();
  });

  it('gives up on a handler that runs too long', async () => {
    const repos = fakeRepos();
    const run = () => new Promise(() => undefined); // never settles
    await runJob(repos, job, { 'test.job': { run, timeoutMs: 20, retryable: true } }, 'w1');
    expect(repos.job.fail.mock.calls[0][2].message).toMatch(/Timed out/);
  });
});

describe('scheduleSlot', () => {
  it('gives every instance the same slot within a period', () => {
    const start = Date.UTC(2026, 10, 12, 10, 0, 0);
    expect(scheduleSlot(start, 15)).toBe(scheduleSlot(start + 14 * 60_000, 15));
    expect(scheduleSlot(start + 15 * 60_000, 15)).toBe(scheduleSlot(start, 15) + 1);
  });
});

describe('handlers', () => {
  it('treats the reset link as a secret that cannot be retried by hand', () => {
    expect(SENSITIVE_JOB_TYPES).toEqual(['auth.password-reset-email']);
    expect(RETRYABLE_JOB_TYPES).not.toContain('auth.password-reset-email');
    expect(RETRYABLE_JOB_TYPES).toContain('order.confirmation-email');
  });

  it('refuses a payload without the field it needs', async () => {
    await expect(jobHandlers['auth.password-reset-email'].run({})).rejects.toThrow(/missing "to"/);
  });
});

describe('emails', () => {
  const noDash = (text) => expect(text).not.toMatch(/—/);

  it('order confirmation lists items, total and the order page', () => {
    const mail = emails.orderConfirmationEmail('a@example.com', {
      orderNumber: 'PAK-123',
      isGuest: true,
      total: 2500,
      deliveryZone: 'PICKUP',
      items: [{ name: 'USB-C cable', quantity: 2, price: 1250 }],
    });
    expect(mail.subject).toBe('We have your order PAK-123');
    expect(mail.text).toContain('USB-C cable x 2');
    expect(mail.text).toContain('/orders/PAK-123');
    expect(mail.text).toContain('same browser');
    noDash(mail.text);
  });

  it('back in stock links to the product', () => {
    const mail = emails.backInStockEmail('a@example.com', { name: 'Anker 737', slug: 'anker-737' });
    expect(mail.subject).toBe('Anker 737 is back in stock');
    expect(mail.text).toContain('/products/anker-737');
    noDash(mail.text);
  });

  it('password reset keeps its wording', () => {
    const mail = emails.passwordResetEmail('a@example.com', 'https://shop/reset?token=t');
    expect(mail.text).toContain('https://shop/reset?token=t');
    expect(mail.text).toContain('expires in one hour');
    noDash(mail.text);
  });
});
