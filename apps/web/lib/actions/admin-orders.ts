'use server';

import { requirePermission } from '@/lib/actions/auth';
import { createRepositories, type OrderStatus } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { getClientIp } from '@/lib/request-context';

/**
 * Order status -> shipment status, for the statuses that imply a physical
 * shipment state. Keeps the Shipment record from going stale when an admin
 * drives fulfilment from the order-status control instead of the shipment
 * form (the reverse direction lives in admin-shipments.ts).
 */
const shipmentStatusForOrderStatus: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
};

export type AdminOrderActionState = {
  error?: string;
  success?: string;
};

function revalidateAdminOrderViews(orderNumber?: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/account/orders');
  if (orderNumber) {
    revalidatePath(`/orders/${orderNumber}`);
  }
}

/**
 * Invalid status transitions now throw from the repository rather than being
 * silently applied, so these actions surface that message to the admin instead
 * of failing opaquely.
 */
function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function updateAdminOrderStatusAction(
  _prevState: AdminOrderActionState | null,
  formData: FormData
): Promise<AdminOrderActionState> {
  const session = await requirePermission('orders.write');

  const orderId = String(formData.get('orderId') ?? '');
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const status = String(formData.get('status') ?? '') as OrderStatus;

  if (!orderId || !status) {
    return { error: 'Missing order details' };
  }

  const repos = createRepositories();

  try {
    await repos.order.updateStatus(orderId, status, undefined, session.user.id);
  } catch (error) {
    console.error('Failed to update order status:', error);
    return { error: messageFor(error, 'Failed to update this order.') };
  }

  // Keep the linked Shipment in step, so an order can't read SHIPPED while
  // its shipment record still says pending.
  const shipmentStatus = shipmentStatusForOrderStatus[status];
  if (shipmentStatus) {
    await repos.shipment.createOrUpdate({ orderId, status: shipmentStatus });
  }

  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'order.status_change',
    entity: 'Order',
    entityId: orderId,
    metadata: { orderNumber, status },
  });

  revalidateAdminOrderViews(orderNumber);

  return { success: `Order marked ${status.toLowerCase()}` };
}

export async function cancelAdminOrderAction(
  _prevState: AdminOrderActionState | null,
  formData: FormData
): Promise<AdminOrderActionState> {
  const session = await requirePermission('orders.write');

  const orderId = String(formData.get('orderId') ?? '');
  const orderNumber = String(formData.get('orderNumber') ?? '');

  if (!orderId) {
    return { error: 'Missing order details' };
  }

  const repos = createRepositories();

  let hadCompletedPayment = false;
  try {
    const before = await repos.order.findByOrderNumber(orderNumber);
    hadCompletedPayment = Boolean(before?.payments.some((p) => p.status === 'COMPLETED'));

    await repos.order.cancelOrder(orderId, 'Cancelled from admin dashboard', session.user.id);
  } catch (error) {
    console.error('Failed to cancel order:', error);
    return { error: messageFor(error, 'Failed to cancel this order.') };
  }

  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'order.cancel',
    entity: 'Order',
    entityId: orderId,
    metadata: { orderNumber, refundOwed: hadCompletedPayment },
  });

  revalidateAdminOrderViews(orderNumber);

  return {
    success: hadCompletedPayment
      ? 'Order cancelled. The payment is marked refunded — process the refund with the provider.'
      : 'Order cancelled',
  };
}

/**
 * Refund a shipped or delivered order. Marks both the order and its completed
 * payment REFUNDED so the money side and the order side stay in step; the
 * actual money movement still happens in the Stripe/M-Pesa dashboard.
 */
export async function refundAdminOrderAction(
  _prevState: AdminOrderActionState | null,
  formData: FormData
): Promise<AdminOrderActionState> {
  const session = await requirePermission('orders.delete');

  const orderId = String(formData.get('orderId') ?? '');
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (!orderId) {
    return { error: 'Missing order details' };
  }

  const repos = createRepositories();

  try {
    await repos.order.refundOrder(
      orderId,
      note || 'Refunded from admin dashboard',
      session.user.id
    );
  } catch (error) {
    console.error('Failed to refund order:', error);
    return { error: messageFor(error, 'Failed to refund this order.') };
  }

  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'order.refund',
    entity: 'Order',
    entityId: orderId,
    metadata: { orderNumber, note: note || undefined },
  });

  revalidateAdminOrderViews(orderNumber);

  return {
    success: 'Order refunded. Process the refund with the payment provider to return the money.',
  };
}
