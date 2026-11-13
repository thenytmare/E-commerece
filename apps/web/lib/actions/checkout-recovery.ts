'use server';
import { createRepositories } from '@repo/database';
import { loadViewableOrder } from '@/lib/order-access';
import { getOrCreateActiveCart } from '@/lib/cart';
import { settleMpesaPayment } from '@/lib/payments/mpesa-settlement';
import { revalidatePath } from 'next/cache';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';

export async function restoreCheckoutAction(orderNumber: string): Promise<{ error?: string; success?: boolean }> {
  const limit = await rateLimit(`restore-checkout:${await clientIdentifier()}`, 10, 5 * 60_000);
  if (!limit.allowed) return { error: retryMessage(limit.retryAfterSeconds) };
  const order = await loadViewableOrder(orderNumber);
  if (!order) return { error: 'Order not found.' };
  const repos = createRepositories();
  try {
    for (const payment of order.payments) {
      if (payment.provider === 'MPESA' && payment.status === 'PENDING' && payment.externalId && await repos.payment.claimProviderQuery(payment.id, 15_000)) {
        await settleMpesaPayment(payment);
      }
    }
    const cart = await getOrCreateActiveCart();
    await repos.order.restoreUnpaidToCart(order.id, cart.id);
    revalidatePath('/cart'); revalidatePath('/', 'layout'); revalidatePath(`/orders/${orderNumber}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not restore your items. Your order is still saved.' };
  }
}
