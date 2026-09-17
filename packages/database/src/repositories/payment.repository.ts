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
  /** Find a single payment by id */
  findById(id: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { id } });
  }

  /** Find payments for an order */
  findByOrderId(orderId: string): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a payment by external provider reference. Scoped by provider
   * because Stripe session ids and M-Pesa CheckoutRequestIDs share this
   * column — an unscoped lookup could match the wrong provider's record.
   */
  findByExternalId(externalId: string, provider?: PaymentProvider): Promise<Payment | null> {
    return this.db.payment.findFirst({
      where: { externalId, ...(provider ? { provider } : {}) },
    });
  }

  /**
   * Payments still awaiting a provider result, oldest first. Used to
   * reconcile M-Pesa transactions whose callback never arrived.
   */
  findStalePending(provider: PaymentProvider, olderThan: Date): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: {
        provider,
        status: 'PENDING',
        externalId: { not: null },
        createdAt: { lt: olderThan },
      },
      orderBy: { createdAt: 'asc' },
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

  /**
   * Record that an STK push was accepted by Daraja.
   *
   * Deliberately keeps the payment PENDING: an accepted STK request only
   * means "prompt delivered", never "payment received". Clears any previous
   * failure so a retry on the same payment row reads cleanly.
   */
  async recordStkRequest(
    paymentId: string,
    input: {
      checkoutRequestId: string;
      payerPhone: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Payment> {
    const existing = await this.db.payment.findUniqueOrThrow({ where: { id: paymentId } });

    // Keep every CheckoutRequestID ever issued for this payment rather than
    // overwriting. A customer can approve an earlier prompt after hitting
    // "try again", and Daraja's callback identifies the transaction only by
    // that id — discarding it meant a real charge arrived carrying an id
    // nothing in the database recognised, and the order was marked FAILED
    // while the customer had actually paid.
    const previous = new Set<string>();
    const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const recorded = existingMetadata.previousCheckoutRequestIds;
    if (Array.isArray(recorded)) {
      for (const id of recorded) {
        if (typeof id === 'string') previous.add(id);
      }
    }
    if (existing.externalId && existing.externalId !== input.checkoutRequestId) {
      previous.add(existing.externalId);
    }

    return this.db.payment.update({
      where: { id: paymentId },
      data: {
        externalId: input.checkoutRequestId,
        payerPhone: input.payerPhone,
        status: 'PENDING',
        failureReason: null,
        metadata: {
          ...(input.metadata ?? {}),
          previousCheckoutRequestIds: [...previous],
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Find an M-Pesa payment by any CheckoutRequestID ever issued for it.
   *
   * Falls back to the superseded ids kept by recordStkRequest, so a callback
   * for a prompt the customer approved late still resolves to its order.
   */
  async findByStkRequestId(checkoutRequestId: string): Promise<Payment | null> {
    const current = await this.db.payment.findFirst({
      where: { externalId: checkoutRequestId, provider: 'MPESA' },
    });
    if (current) return current;

    return this.db.payment.findFirst({
      where: {
        provider: 'MPESA',
        metadata: {
          path: ['previousCheckoutRequestIds'],
          array_contains: checkoutRequestId,
        },
      },
    });
  }

  /** Mark payment completed and confirm the order */
  async completePayment(
    paymentId: string,
    externalId?: string,
    metadata?: Prisma.InputJsonValue,
    details?: { receiptNumber?: string; payerPhone?: string }
  ): Promise<Payment> {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

      // Idempotent: a retried callback for an already-settled payment is a
      // no-op rather than a second order confirmation.
      if (payment.status === 'COMPLETED') {
        return payment;
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          paidAt: new Date(),
          failureReason: null,
          ...(details?.receiptNumber ? { receiptNumber: details.receiptNumber } : {}),
          ...(details?.payerPhone ? { payerPhone: details.payerPhone } : {}),
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
      } else {
        // The order left PENDING before this payment settled — most likely
        // the 24-hour abandon-reconciliation sweep (see
        // apps/web/lib/payments/reconcile.ts) auto-cancelled it and released
        // its stock to be resold. The payment above is still marked
        // COMPLETED because the money was genuinely received, but the order
        // is deliberately NOT reinstated here: stock and pricing may have
        // moved on since it was cancelled, so auto-confirming it is unsafe.
        // Leave an audit trail instead, so an admin can find it and decide
        // whether to refund the payment or manually restock and confirm the
        // order — without this, the mismatch was previously silent.
        await tx.auditLog.create({
          data: {
            action: 'payment.completed_after_cancel',
            entity: 'Order',
            entityId: order.id,
            actorId: null,
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderStatus: order.status,
              paymentId: updated.id,
              provider: updated.provider,
              amount: updated.amount.toNumber(),
              currency: order.currency,
              externalId: updated.externalId,
            },
          },
        });
      }

      return updated;
    });
  }

  /**
   * Mark payment failed.
   *
   * Idempotent and non-regressive: a late or duplicated failure callback can
   * never move an already-COMPLETED payment back to FAILED, which would
   * otherwise un-pay a confirmed order.
   */
  async markFailed(
    paymentId: string,
    metadata?: Prisma.InputJsonValue,
    failureReason?: string
  ): Promise<Payment> {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

      if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
        return payment;
      }
      if (payment.status === 'FAILED') {
        return payment;
      }

      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          ...(failureReason ? { failureReason } : {}),
          ...(metadata !== undefined ? { metadata } : {}),
        },
      });
    });
  }
}

export type { Payment, PaymentProvider, PaymentStatus };
