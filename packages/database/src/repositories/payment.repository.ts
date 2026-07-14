import type { Payment, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface CreatePaymentInput {
  orderId: string;
  provider: PaymentProvider;
  method: string;
  amount: number;
  externalId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Data access for order payments.
 */
export class PaymentRepository extends BaseRepository {
  /** Find payments for an order */
  findByOrderId(orderId: string): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Find a payment by external provider reference */
  findByExternalId(externalId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({
      where: { externalId },
    });
  }

  /** Find the completed payment for an order, if any */
  findCompletedByOrderId(orderId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({
      where: { orderId, status: 'COMPLETED' },
    });
  }

  /** Create a pending payment record */
  createPending(input: CreatePaymentInput): Promise<Payment> {
    return this.db.payment.create({
      data: {
        orderId: input.orderId,
        provider: input.provider,
        method: input.method,
        amount: new PrismaNamespace.Decimal(input.amount),
        status: 'PENDING',
        externalId: input.externalId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  /** Attach an external provider reference to a payment */
  updateExternalId(paymentId: string, externalId: string): Promise<Payment> {
    return this.db.payment.update({
      where: { id: paymentId },
      data: { externalId },
    });
  }

  /** Mark payment completed and confirm the order */
  async completePayment(
    paymentId: string,
    externalId?: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<Payment> {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

      if (payment.status === 'COMPLETED') {
        return payment;
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          ...(externalId ? { externalId } : {}),
          ...(metadata !== undefined ? { metadata } : {}),
        },
      });

      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      if (order.status === 'PENDING') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CONFIRMED' },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: 'CONFIRMED',
            note: `Payment received via ${updated.provider}`,
          },
        });
      }

      return updated;
    });
  }

  /** Mark payment failed */
  markFailed(paymentId: string, metadata?: Prisma.InputJsonValue): Promise<Payment> {
    return this.db.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  }
}

export type { Payment, PaymentProvider, PaymentStatus };
