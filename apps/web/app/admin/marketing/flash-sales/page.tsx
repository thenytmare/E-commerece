import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { FlashSaleListClient } from './FlashSaleListClient';

export const metadata = { title: 'Flash Sales | Admin' };

export default async function FlashSalesPage() {
  await requirePermission('marketing.read');
  const repos = createRepositories();

  const [sales, products] = await Promise.all([
    repos.flashSale.findMany({ limit: 100 }),
    repos.product.findMany({ isActive: true, limit: 100 }),
  ]);

  return (
    <AdminPage
      title="Flash Sales"
      description="Schedule time-limited price drops. Active sales override the product price on the storefront."
    >
      <FlashSaleListClient
        initialData={sales.items.map((sale) => ({
          id: sale.id,
          productId: sale.productId,
          productName: sale.product.name,
          salePrice: Number(sale.salePrice),
          basePrice: Number(sale.product.basePrice),
          startsAt: sale.startsAt.toISOString(),
          endsAt: sale.endsAt.toISOString(),
        }))}
        products={products.items.map((p) => ({
          id: p.id,
          name: p.name,
          basePrice: Number(p.basePrice),
        }))}
      />
    </AdminPage>
  );
}
