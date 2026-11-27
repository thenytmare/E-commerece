import { requirePermission } from '@/lib/actions/auth';
import { createRepositories } from '@repo/database';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { ConfirmationQueue, type PendingManualPayment } from './ConfirmationQueue';

export const dynamic = 'force-dynamic';

export default async function PaymentConfirmationsPage() {
  await requirePermission('orders.write');

  const repos = createRepositories();
  const rows = await repos.payment.findManualAwaitingConfirmation();

  const payments: PendingManualPayment[] = rows.map((p) => {
    const metadata = (p.metadata ?? {}) as Record<string, unknown>;
    const customer =
      p.order.user?.name ||
      p.order.user?.email ||
      p.order.guestEmail ||
      'Guest';
    return {
      id: p.id,
      orderNumber: p.order.orderNumber,
      amount: Number(p.amount),
      currency: p.order.currency,
      customer,
      code: p.receiptNumber ?? '—',
      payerPhone: p.payerPhone ?? null,
      rawMessage: typeof metadata.rawMessage === 'string' ? metadata.rawMessage : null,
      submittedAt: p.createdAt.toISOString(),
    };
  });

  return (
    <AdminPage
      title="Payment confirmations"
      description="M-Pesa Paybill payments waiting for a staff member to verify. Check each code against your M-Pesa statement, then confirm or reject it."
    >
      <ConfirmationQueue payments={payments} />
    </AdminPage>
  );
}
