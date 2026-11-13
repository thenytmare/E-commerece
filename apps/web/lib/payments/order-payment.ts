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

  // Repository checks the order again under its lock, including on retries.
  return repos.payment.createPending({
    orderId: order.id,
    provider,
    method,
    amount: orderTotal(order),
  });
}
