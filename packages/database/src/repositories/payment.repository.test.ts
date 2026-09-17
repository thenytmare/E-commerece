import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentRepository } from './payment.repository';

describe('PaymentRepository', () => {
  const mockDb = {
    payment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    orderStatusHistory: { create: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  };

  const repo = new PaymentRepository(mockDb as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createPending creates a payment with PENDING status', async () => {
    mockDb.payment.create.mockResolvedValue({ id: 'pay-1', status: 'PENDING' });

    await repo.createPending({
      orderId: 'order-1',
      provider: 'STRIPE',
      method: 'card',
      amount: 1500,
    });

    expect(mockDb.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          provider: 'STRIPE',
          status: 'PENDING',
        }),
      })
    );
  });

  it('completePayment confirms a pending order', async () => {
    mockDb.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'PENDING',
      provider: 'MPESA',
    });
    mockDb.payment.update.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'COMPLETED',
      provider: 'MPESA',
    });
    mockDb.order.findUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
    });

    await repo.completePayment('pay-1', 'receipt-123');

    expect(mockDb.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'CONFIRMED' },
    });
    expect(mockDb.orderStatusHistory.create).toHaveBeenCalled();
  });

  it('completePayment persists M-Pesa receipt and payer phone', async () => {
    mockDb.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'PENDING',
      provider: 'MPESA',
    });
    mockDb.payment.update.mockResolvedValue({ id: 'pay-1', status: 'COMPLETED' });
    mockDb.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', status: 'PENDING' });

    await repo.completePayment('pay-1', 'ws_CO_1', undefined, {
      receiptNumber: 'SFF1ABCDEF',
      payerPhone: '254712345678',
    });

    expect(mockDb.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          receiptNumber: 'SFF1ABCDEF',
          payerPhone: '254712345678',
        }),
      })
    );
  });

  // A retried Safaricom callback must not confirm the order twice.
  it('completePayment is idempotent for an already-completed payment', async () => {
    mockDb.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'COMPLETED',
      provider: 'MPESA',
    });

    const result = await repo.completePayment('pay-1', 'receipt-123');

    expect(result).toMatchObject({ status: 'COMPLETED' });
    expect(mockDb.payment.update).not.toHaveBeenCalled();
    expect(mockDb.order.update).not.toHaveBeenCalled();
    expect(mockDb.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  // The regression this guards: a late failure callback arriving after a
  // successful one previously flipped a paid order back to FAILED.
  it('markFailed never downgrades a COMPLETED payment', async () => {
    mockDb.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'COMPLETED',
      provider: 'MPESA',
    });

    const result = await repo.markFailed('pay-1', { resultCode: 1032 }, 'Cancelled by customer');

    expect(result).toMatchObject({ status: 'COMPLETED' });
    expect(mockDb.payment.update).not.toHaveBeenCalled();
  });

  it('markFailed is idempotent for an already-failed payment', async () => {
    mockDb.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'FAILED',
      provider: 'MPESA',
    });

    await repo.markFailed('pay-1', { resultCode: 1032 });

    expect(mockDb.payment.update).not.toHaveBeenCalled();
  });

  it('markFailed records the failure reason on a pending payment', async () => {
    mockDb.payment.findUniqueOrThrow.mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'PENDING',
      provider: 'MPESA',
    });
    mockDb.payment.update.mockResolvedValue({ id: 'pay-1', status: 'FAILED' });

    await repo.markFailed('pay-1', { resultCode: 1032 }, 'Cancelled by customer');

    expect(mockDb.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          failureReason: 'Cancelled by customer',
        }),
      })
    );
  });

  it('recordStkRequest keeps the payment PENDING after an accepted STK push', async () => {
    mockDb.payment.update.mockResolvedValue({ id: 'pay-1', status: 'PENDING' });

    await repo.recordStkRequest('pay-1', {
      checkoutRequestId: 'ws_CO_123',
      payerPhone: '254712345678',
    });

    expect(mockDb.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          externalId: 'ws_CO_123',
          payerPhone: '254712345678',
          failureReason: null,
        }),
      })
    );
  });

  it('findByExternalId scopes the lookup by provider', async () => {
    mockDb.payment.findFirst.mockResolvedValue(null);

    await repo.findByExternalId('ws_CO_123', 'MPESA');

    expect(mockDb.payment.findFirst).toHaveBeenCalledWith({
      where: { externalId: 'ws_CO_123', provider: 'MPESA' },
    });
  });
});
