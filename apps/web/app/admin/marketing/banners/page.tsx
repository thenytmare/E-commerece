import { AdminPage } from '@/components/admin/ui/AdminPage';
import { BannerListClient } from './BannerListClient';
import { getAllBanners } from '@/lib/banners';
import { requirePermission } from '@/lib/actions/auth';

export const metadata = { title: 'Banners | Admin' };

export default async function BannersPage() {
  await requirePermission('marketing.read');
  const banners = await getAllBanners();

  return (
    <AdminPage title="Banners & Promotions" description="Manage promotional banners and announcements.">
      <BannerListClient initialData={banners} />
    </AdminPage>
  );
}