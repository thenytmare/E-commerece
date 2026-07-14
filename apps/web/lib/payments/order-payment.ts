import { createRepositories, type OrderDetail } from '@repo/database';

function orderTotal(order: OrderDetail): number {
  return typeof order.total === 'object' && 'toNumber' in order.total
    ? order.total.toNumber()
    : Number(order.total);
}

/** Ensure a pending payment exists for the order and provider */
export async function getOrCreatePendingPayment(
  order: OrderDetail,
  provider: 'STRIPE' | 'MPESA',
  method: string
) {
  const repos = createRepositories();
  const completed = await repos.payment.findCompletedByOrderId(order.id);
  if (completed) {
    throw new Error('Order is already paid');
  }

  const pending = await repos.payment.findByOrderId(order.id);
  const existing = pending.find((p) => p.provider === provider && p.status === 'PENDING');
  if (existing) {
    return existing;
  }

  return repos.payment.createPending({
    orderId: order.id,
    provider,
    method,
    amount: orderTotal(order),
  });
}
