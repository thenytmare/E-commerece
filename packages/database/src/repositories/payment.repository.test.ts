import { describe, expect, it, vi } from 'vitest';
import { PaymentRepository } from './payment.repository';

describe('PaymentRepository', () => {
  const mockDb = {
    payment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
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
});
