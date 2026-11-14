import { BACK_IN_STOCK_EMAIL_JOB, ORDER_CONFIRMATION_JOB, prisma } from '@repo/database';
import { isMailConfigured, sendMail } from '@/lib/mail';
import { backInStockEmail, orderConfirmationEmail, passwordResetEmail, staffInviteEmail } from './emails';
import { PASSWORD_RESET_EMAIL_JOB, RECONCILE_PAYMENTS_JOB, STAFF_INVITE_EMAIL_JOB } from './types';

/**
 * What each job type does.
 *
 * Every handler must be safe to run twice. Jobs can run again when a worker
 * stops after the work but before it records "done". For email this means a
 * rare duplicate email is possible; it can never mean a duplicate charge,
 * refund or stock change, because no handler here does those.
 *
 * Handlers re-read the database instead of trusting the payload, so a job
 * that waited (for example during a mail outage) acts on the current state.
 */

export { PASSWORD_RESET_EMAIL_JOB, RECONCILE_PAYMENTS_JOB, STAFF_INVITE_EMAIL_JOB };

export interface JobHandler {
  run(payload: unknown): Promise<void>;
  /** The worker gives up on one run after this long and retries later. */
  timeoutMs: number;
  /** Payload is a secret (a reset link). Cleared when the job ends. */
  sensitive?: boolean;
  /** An admin may retry it from the jobs page after it fails. */
  retryable: boolean;
}

function field(payload: unknown, name: string): string {
  const value = (payload as Record<string, unknown> | null)?.[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Job payload is missing "${name}".`);
  }
  return value;
}

export const jobHandlers: Record<string, JobHandler> = {
  [PASSWORD_RESET_EMAIL_JOB]: {
    timeoutMs: 30_000,
    sensitive: true,
    // The link inside is cleared on failure, and it expires after an hour
    // anyway. The customer asks for a new one instead.
    retryable: false,
    async run(payload) {
      await sendMail(passwordResetEmail(field(payload, 'to'), field(payload, 'resetUrl')));
    },
  },

  [STAFF_INVITE_EMAIL_JOB]: {
    timeoutMs: 30_000,
    sensitive: true,
    // Same as a reset link: cleared on failure. The admin sends a new invite
    // from the Staff page instead.
    retryable: false,
    async run(payload) {
      await sendMail(staffInviteEmail(field(payload, 'to'), field(payload, 'setPasswordUrl'), field(payload, 'roleLabel')));
    },
  },

  [ORDER_CONFIRMATION_JOB]: {
    timeoutMs: 30_000,
    retryable: true,
    async run(payload) {
      const order = await prisma.order.findUnique({
        where: { id: field(payload, 'orderId') },
        select: {
          orderNumber: true,
          guestEmail: true,
          total: true,
          deliveryZone: true,
          user: { select: { email: true } },
          items: { select: { name: true, quantity: true, price: true }, orderBy: { id: 'asc' } },
        },
      });
      // Optional email: with no mail server set up, skip it instead of
      // filling the failed list. The jobs page says mail is not set up.
      if (process.env.NODE_ENV === 'production' && !isMailConfigured()) return;
      if (!order) return; // Order removed since. Nothing to say.
      const to = order.user?.email ?? order.guestEmail;
      if (!to) return; // No address to write to.
      await sendMail(
        orderConfirmationEmail(to, {
          orderNumber: order.orderNumber,
          isGuest: !order.user,
          total: order.total,
          items: order.items,
          deliveryZone: order.deliveryZone ?? '',
        })
      );
    },
  },

  [BACK_IN_STOCK_EMAIL_JOB]: {
    timeoutMs: 30_000,
    retryable: true,
    async run(payload) {
      const sub = await prisma.backInStockNotification.findUnique({
        where: { id: field(payload, 'subscriptionId') },
        select: {
          email: true,
          user: { select: { email: true } },
          product: { select: { name: true, slug: true, isActive: true, deletedAt: true } },
        },
      });
      if (process.env.NODE_ENV === 'production' && !isMailConfigured()) return; // Same as order emails.
      if (!sub) return;
      // Hidden again since the restock: do not send people to a missing page.
      if (!sub.product.isActive || sub.product.deletedAt) return;
      const to = sub.email ?? sub.user?.email;
      if (!to) return;
      await sendMail(backInStockEmail(to, sub.product));
    },
  },

  [RECONCILE_PAYMENTS_JOB]: {
    // The reconcile run holds its own 10-minute lease, so a second copy that
    // starts while one is running stops at once and does nothing.
    timeoutMs: 9 * 60_000,
    retryable: true,
    async run() {
      const { reconcileStalePayments } = await import('@/lib/payments/reconcile');
      const summary = await reconcileStalePayments();
      console.log(JSON.stringify({ type: 'jobs.reconcile', ...summary }));
    },
  },
};

export const SENSITIVE_JOB_TYPES = Object.entries(jobHandlers)
  .filter(([, handler]) => handler.sensitive)
  .map(([type]) => type);

export const RETRYABLE_JOB_TYPES = Object.entries(jobHandlers)
  .filter(([, handler]) => handler.retryable)
  .map(([type]) => type);
