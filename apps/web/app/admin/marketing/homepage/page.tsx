import { AdminPage } from '@/components/admin/ui/AdminPage';
import { HomepageBuilderClient } from './HomepageBuilderClient';
import { getHomepageSections } from '@/lib/homepage';
import { requirePermission } from '@/lib/actions/auth';

export const metadata = { title: 'Homepage Builder | Admin' };

export default async function HomepageBuilderPage() {
  await requirePermission('marketing.read');
  const sections = await getHomepageSections();

  return (
    <AdminPage title="Homepage Builder" description="Customize homepage layout and sections.">
      <HomepageBuilderClient initialSections={sections} />
    </AdminPage>
  );
}