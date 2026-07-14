'use server';

import { requireAdmin } from '@/lib/actions/auth';
import { createRepositories, type OrderStatus } from '@repo/database';
import { revalidatePath } from 'next/cache';

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

export async function updateAdminOrderStatusAction(
  _prevState: AdminOrderActionState | null,
  formData: FormData
): Promise<AdminOrderActionState> {
  await requireAdmin();

  const orderId = String(formData.get('orderId') ?? '');
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const status = String(formData.get('status') ?? '') as OrderStatus;

  if (!orderId || !status) {
    return { error: 'Missing order details' };
  }

  const repos = createRepositories();
  await repos.order.updateStatus(orderId, status);
  revalidateAdminOrderViews(orderNumber);

  return { success: `Order marked ${status.toLowerCase()}` };
}

export async function cancelAdminOrderAction(
  _prevState: AdminOrderActionState | null,
  formData: FormData
): Promise<AdminOrderActionState> {
  await requireAdmin();

  const orderId = String(formData.get('orderId') ?? '');
  const orderNumber = String(formData.get('orderNumber') ?? '');

  if (!orderId) {
    return { error: 'Missing order details' };
  }

  const repos = createRepositories();
  await repos.order.cancelOrder(orderId, 'Cancelled from admin dashboard');
  revalidateAdminOrderViews(orderNumber);

  return { success: 'Order cancelled' };
}
