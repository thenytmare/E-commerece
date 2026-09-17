import { createRepositories } from '@repo/database';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { CouponListClient } from './CouponListClient';
import { requirePermission } from '@/lib/actions/auth';

export const metadata = { title: 'Coupons | Admin' };

export default async function CouponsPage() {
  await requirePermission('marketing.read');
  const repos = createRepositories();
  const { items } = await repos.coupon.findMany({ limit: 100 });

  return (
    <AdminPage title="Coupons" description="Create and manage discount coupons for your store.">
      <CouponListClient coupons={items.map(c => ({
        ...c,
        type: c.type as 'PERCENTAGE' | 'FIXED',
        value: Number(c.value),
        minOrder: c.minOrder ? Number(c.minOrder) : null,
        maxUses: c.maxUses ?? null,
        maxUsesPerCustomer: c.maxUsesPerCustomer ?? null,
        startsAt: c.startsAt?.toISOString() ?? null,
        endsAt: c.endsAt?.toISOString() ?? null,
      }))} />
    </AdminPage>
  );
}