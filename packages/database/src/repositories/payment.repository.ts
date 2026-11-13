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
  findStalePending(provider: PaymentProvider, olderThan: Date, limit = 25): Promise<Payment[]> {
    return this.db.payment.findMany({
      take: limit,
      where: {
        provider,
        status: 'PENDING',
        externalId: { not: null },
        createdAt: { lt: olderThan },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Ask for permission to query the provider about this payment.
   *
   * One conditional statement stamps the time of the query, but only if the
   * last query was more than `cooldownMs` ago. Of many tabs polling at once,
   * exactly one gets `true`. The rest get `false` and just read the stored
   * state. The stamp lives in the metadata JSON, so no schema change is needed.
   */
  async claimProviderQuery(paymentId: string, cooldownMs: number): Promise<boolean> {
    const changed = await this.db.$executeRaw`
      UPDATE "payments"
      SET "metadata" = jsonb_set(
        COALESCE("metadata", '{}'::jsonb),
        '{lastProviderQueryAt}',
        to_jsonb(now()::text)
      )
      WHERE "id" = ${paymentId}
        AND "status" = 'PENDING'
        AND (
          "metadata"->>'lastProviderQueryAt' IS NULL
          OR ("metadata"->>'lastProviderQueryAt')::timestamptz
             < now() - (${cooldownMs} * interval '1 millisecond')
        )
    `;
    return changed === 1;
  }

  /** Find the completed payment for an order, if any */
  findCompletedByOrderId(orderId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({
      where: { orderId, status: 'COMPLETED' },
    });
  }

  /** Create a pending payment record */
  async createPending(input: CreatePaymentInput): Promise<Payment> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
      if (order.status !== 'PENDING') throw new Error('This order is not awaiting payment');
      const completed = await tx.payment.findFirst({ where: { orderId: input.orderId, status: 'COMPLETED' } });
      if (completed) throw new Error('This order has already been paid');
      const pending = await tx.payment.findFirst({ where: { orderId: input.orderId, provider: input.provider, status: 'PENDING' } });
      if (pending) return pending;
      return tx.payment.create({
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
    return this.db.$transaction(async (tx) => {
      // Lock the row so two simultaneous prompts can't both read the same
      // metadata and overwrite each other's list of CheckoutRequestIDs.
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} FOR UPDATE`;
      const existing = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

      // A settled payment never goes back to PENDING. The prompt id is still
      // remembered so a late callback for it can be matched.
      const settled = existing.status === 'COMPLETED' || existing.status === 'REFUNDED';

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
      if (settled) previous.add(input.checkoutRequestId);

      return tx.payment.update({
        where: { id: paymentId },
        data: settled
          ? {
              metadata: {
                ...existingMetadata,
                previousCheckoutRequestIds: [...previous],
              } as Prisma.InputJsonValue,
            }
          : {
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

  /**
   * Mark payment completed and confirm the order.
   *
   * Moves the payment forward only: PENDING (or FAILED, for a success that
   * arrives after a failure notice) becomes COMPLETED. The change is a single
   * conditional update, so two callbacks racing each other cannot both apply
   * it, and a COMPLETED or REFUNDED payment is never touched again.
   */
  async completePayment(
    paymentId: string,
    externalId?: string,
    metadata?: Prisma.InputJsonValue,
    details?: { receiptNumber?: string; payerPhone?: string }
  ): Promise<Payment> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${current.orderId} FOR UPDATE`;
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['PENDING', 'FAILED'] } },
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

      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

      // Idempotent: a retried callback for an already-settled payment (or one
      // that lost the race to another callback) is a no-op rather than a
      // second order confirmation.
      if (claimed.count === 0) {
        return payment;
      }

      // Confirm the order only if it is still PENDING; the conditional update
      // decides, so only one caller writes the history row.
      const confirmed = await tx.order.updateMany({
        where: { id: payment.orderId, status: 'PENDING' },
        data: { status: 'CONFIRMED' },
      });

      if (confirmed.count === 1) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            status: 'CONFIRMED',
            note: `Payment received via ${payment.provider}`,
          },
        });
      } else {
        // The order left PENDING before this payment settled — most likely
        // the 24-hour abandon-reconciliation sweep (see
        // apps/web/lib/payments/reconcile.ts) auto-cancelled it and released
        // its stock to be resold, or it was confirmed another way (cash on
        // delivery). The payment above is still marked COMPLETED because the
        // money was genuinely received, but the order is deliberately NOT
        // reinstated here: stock and pricing may have moved on since, so
        // auto-confirming it is unsafe. Leave an audit trail instead, so an
        // admin can find it and decide whether to refund the payment or
        // manually restock and confirm the order.
        const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
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
              paymentId: payment.id,
              provider: payment.provider,
              amount: payment.amount.toNumber(),
              currency: order.currency,
              externalId: payment.externalId,
            },
          },
        });
      }

      return payment;
    });
  }

  /**
   * Mark payment failed.
   *
   * Only a PENDING payment can fail, and the change is one conditional
   * update. A late or duplicated failure callback can therefore never move
   * an already COMPLETED or REFUNDED payment back to FAILED, even when it
   * races a success callback that commits between its read and its write.
   */
  async markFailed(
    paymentId: string,
    metadata?: Prisma.InputJsonValue,
    failureReason?: string
  ): Promise<Payment> {
    await this.db.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'FAILED',
        ...(failureReason ? { failureReason } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
    return this.db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }

  /**
   * Record a provider payment that did NOT match what we expected (wrong
   * amount, wrong currency, someone else's session). The payment stays
   * PENDING and the order stays unconfirmed; an admin reviews the audit entry.
   */
  async recordMismatch(
    paymentId: string,
    details: { reason: string; provider: PaymentProvider; externalId?: string | null }
  ): Promise<void> {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;
    // Reconciliation re-checks the same payment on every pass; one entry an
    // hour is enough for an admin to notice.
    const recent = await this.db.auditLog.findFirst({
      where: {
        action: 'payment.verification_failed',
        entityId: payment.id,
        createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
      },
    });
    if (recent) return;
    await this.db.auditLog.create({
      data: {
        action: 'payment.verification_failed',
        entity: 'Payment',
        entityId: payment.id,
        actorId: null,
        metadata: {
          orderId: payment.orderId,
          paymentId: payment.id,
          provider: details.provider,
          expectedAmount: payment.amount.toNumber(),
          externalId: details.externalId ?? payment.externalId,
          reason: details.reason,
        },
      },
    });
  }
}

export type { Payment, PaymentProvider, PaymentStatus };
