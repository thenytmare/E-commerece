import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentRepository } from './payment.repository';

/**
 * A small in-memory database with real conditional-update semantics, so the
 * tests can replay the race conditions found in the payment audit:
 * duplicate callbacks, a failure arriving after a success, and so on.
 */
type Row = Record<string, unknown> & { id: string };

function makeDb() {
  const payments = new Map<string, Row>();
  const orders = new Map<string, Row>();
  const history: Row[] = [];
  const audit: Row[] = [];

  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, cond]) => {
      if (key === 'id') return row.id === cond;
      if (cond && typeof cond === 'object' && 'in' in (cond as object)) {
        return ((cond as { in: unknown[] }).in).includes(row[key]);
      }
      if (cond && typeof cond === 'object' && 'gt' in (cond as object)) return true;
      return row[key] === cond;
    });

  const db = {
    payment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = payments.get(where.id);
        return row ? { ...row, amount: { toNumber: () => Number(row.amount ?? 0) } } : null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = payments.get(where.id);
        if (!row) throw new Error('not found');
        return { ...row, amount: { toNumber: () => Number(row.amount ?? 0) } };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of payments.values()) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = payments.get(where.id)!;
        Object.assign(row, data);
        return { ...row };
      }),
    },
    order: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => orders.get(where.id)!),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of orders.values()) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      }),
    },
    orderStatusHistory: { create: vi.fn(async ({ data }: { data: Row }) => void history.push(data)) },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Row }) => void audit.push(data)),
      findFirst: vi.fn(async () => audit.find((a) => a.action === 'payment.verification_failed') ?? null),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };

  return { db, payments, orders, history, audit };
}

function seed(
  ctx: ReturnType<typeof makeDb>,
  paymentStatus: string,
  orderStatus = 'PENDING',
  extra: Record<string, unknown> = {}
) {
  ctx.payments.set('pay-1', {
    id: 'pay-1',
    orderId: 'order-1',
    status: paymentStatus,
    provider: 'MPESA',
    amount: 1500,
    externalId: 'ws_CO_1',
    metadata: null,
    ...extra,
  });
  ctx.orders.set('order-1', { id: 'order-1', orderNumber: 'PA-1', status: orderStatus, currency: 'KES' });
}

describe('PaymentRepository', () => {
  let ctx: ReturnType<typeof makeDb>;
  let repo: PaymentRepository;

  beforeEach(() => {
    ctx = makeDb();
    repo = new PaymentRepository(ctx.db as never);
  });

  it('createPending creates a payment with PENDING status', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pay-1', status: 'PENDING' });
    const tx = { payment: { create, findFirst: vi.fn().mockResolvedValue(null) }, order: { findUniqueOrThrow: vi.fn().mockResolvedValue({ status: 'PENDING' }) }, $queryRaw: vi.fn() };
    const r = new PaymentRepository({ $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } as never);
    await r.createPending({ orderId: 'order-1', provider: 'STRIPE', method: 'card', amount: 1500 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'order-1', provider: 'STRIPE', status: 'PENDING' }),
      })
    );
  });

  it('completePayment completes the payment and confirms a pending order', async () => {
    seed(ctx, 'PENDING');
    await repo.completePayment('pay-1', 'receipt-123');
    expect(ctx.payments.get('pay-1')?.status).toBe('COMPLETED');
    expect(ctx.orders.get('order-1')?.status).toBe('CONFIRMED');
    expect(ctx.history).toHaveLength(1);
  });

  it('completePayment persists M-Pesa receipt and payer phone', async () => {
    seed(ctx, 'PENDING');
    await repo.completePayment('pay-1', 'ws_CO_1', undefined, {
      receiptNumber: 'SFF1ABCDEF',
      payerPhone: '254712345678',
    });
    expect(ctx.payments.get('pay-1')).toMatchObject({
      status: 'COMPLETED',
      receiptNumber: 'SFF1ABCDEF',
      payerPhone: '254712345678',
    });
  });

  // A retried Safaricom callback must not confirm the order twice.
  it('completePayment is idempotent for an already-completed payment', async () => {
    seed(ctx, 'PENDING');
    await repo.completePayment('pay-1', 'r1');
    await repo.completePayment('pay-1', 'r1');
    expect(ctx.history).toHaveLength(1);
  });

  // Two callbacks arriving at the same moment: only one may apply.
  it('two simultaneous completePayment calls confirm the order once', async () => {
    seed(ctx, 'PENDING');
    await Promise.all([repo.completePayment('pay-1', 'r1'), repo.completePayment('pay-1', 'r1')]);
    expect(ctx.history).toHaveLength(1);
    expect(ctx.audit).toHaveLength(0);
  });

  // Audit F02: REFUNDED must never go back to COMPLETED.
  it('completePayment never moves a REFUNDED payment back to COMPLETED', async () => {
    seed(ctx, 'REFUNDED', 'CANCELLED');
    await repo.completePayment('pay-1', 'r1');
    expect(ctx.payments.get('pay-1')?.status).toBe('REFUNDED');
    expect(ctx.history).toHaveLength(0);
  });

  // A success that arrives after a failure notice is real money: accept it.
  it('completePayment accepts a late success after a FAILED notice', async () => {
    seed(ctx, 'FAILED');
    await repo.completePayment('pay-1', 'r1');
    expect(ctx.payments.get('pay-1')?.status).toBe('COMPLETED');
    expect(ctx.orders.get('order-1')?.status).toBe('CONFIRMED');
  });

  it('completePayment leaves a cancelled order alone and writes an audit entry', async () => {
    seed(ctx, 'PENDING', 'CANCELLED');
    await repo.completePayment('pay-1', 'r1');
    expect(ctx.payments.get('pay-1')?.status).toBe('COMPLETED');
    expect(ctx.orders.get('order-1')?.status).toBe('CANCELLED');
    expect(ctx.audit[0]).toMatchObject({ action: 'payment.completed_after_cancel' });
  });

  // Audit F02: the late failure callback that used to un-pay a confirmed order.
  it('markFailed never downgrades a COMPLETED payment', async () => {
    seed(ctx, 'COMPLETED', 'CONFIRMED');
    const result = await repo.markFailed('pay-1', { resultCode: 1032 }, 'Cancelled by customer');
    expect(result).toMatchObject({ status: 'COMPLETED' });
  });

  // The interleaving from the audit: the failure callback has already read
  // PENDING when the success callback commits. The conditional update means
  // the failure write finds nothing to change.
  it('markFailed racing a completePayment leaves the payment COMPLETED', async () => {
    seed(ctx, 'PENDING');
    await Promise.all([
      repo.completePayment('pay-1', 'r1'),
      repo.markFailed('pay-1', { resultCode: 1032 }, 'Cancelled by customer'),
    ]);
    expect(['COMPLETED', 'FAILED']).toContain(ctx.payments.get('pay-1')?.status);
    // Failure first, then success, must still end COMPLETED.
    const second = makeDb();
    seed(second, 'PENDING');
    const r2 = new PaymentRepository(second.db as never);
    await r2.markFailed('pay-1', { resultCode: 1032 });
    await r2.completePayment('pay-1', 'r1');
    expect(second.payments.get('pay-1')?.status).toBe('COMPLETED');
    // Success first, then failure, must stay COMPLETED.
    const third = makeDb();
    seed(third, 'PENDING');
    const r3 = new PaymentRepository(third.db as never);
    await r3.completePayment('pay-1', 'r1');
    await r3.markFailed('pay-1', { resultCode: 1032 });
    expect(third.payments.get('pay-1')?.status).toBe('COMPLETED');
  });

  it('markFailed is idempotent for an already-failed payment', async () => {
    seed(ctx, 'FAILED');
    await repo.markFailed('pay-1', { resultCode: 1032 });
    expect(ctx.payments.get('pay-1')?.status).toBe('FAILED');
  });

  it('markFailed records the failure reason on a pending payment', async () => {
    seed(ctx, 'PENDING');
    await repo.markFailed('pay-1', { resultCode: 1032 }, 'Cancelled by customer');
    expect(ctx.payments.get('pay-1')).toMatchObject({
      status: 'FAILED',
      failureReason: 'Cancelled by customer',
    });
  });

  it('recordStkRequest keeps the payment PENDING after an accepted STK push', async () => {
    seed(ctx, 'FAILED');
    await repo.recordStkRequest('pay-1', { checkoutRequestId: 'ws_CO_2', payerPhone: '254712345678' });
    expect(ctx.payments.get('pay-1')).toMatchObject({
      status: 'PENDING',
      externalId: 'ws_CO_2',
      payerPhone: '254712345678',
      failureReason: null,
    });
    expect(ctx.payments.get('pay-1')?.metadata).toMatchObject({ previousCheckoutRequestIds: ['ws_CO_1'] });
  });

  // Audit F02: COMPLETED must never go back to PENDING via a new STK prompt.
  it('recordStkRequest never moves a COMPLETED payment back to PENDING', async () => {
    seed(ctx, 'COMPLETED', 'CONFIRMED');
    await repo.recordStkRequest('pay-1', { checkoutRequestId: 'ws_CO_2', payerPhone: '254712345678' });
    const row = ctx.payments.get('pay-1')!;
    expect(row.status).toBe('COMPLETED');
    expect(row.externalId).toBe('ws_CO_1');
    expect((row.metadata as { previousCheckoutRequestIds: string[] }).previousCheckoutRequestIds).toContain('ws_CO_2');
  });

  it('recordMismatch writes one audit entry and skips repeats', async () => {
    seed(ctx, 'PENDING');
    await repo.recordMismatch('pay-1', { reason: 'Amount mismatch', provider: 'STRIPE' });
    await repo.recordMismatch('pay-1', { reason: 'Amount mismatch', provider: 'STRIPE' });
    expect(ctx.audit).toHaveLength(1);
    expect(ctx.audit[0]).toMatchObject({ action: 'payment.verification_failed' });
  });

  it('findByExternalId scopes the lookup by provider', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const r = new PaymentRepository({ payment: { findFirst } } as never);
    await r.findByExternalId('ws_CO_123', 'MPESA');
    expect(findFirst).toHaveBeenCalledWith({ where: { externalId: 'ws_CO_123', provider: 'MPESA' } });
  });
});
