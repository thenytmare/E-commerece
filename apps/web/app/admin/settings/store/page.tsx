import { requirePermission } from '@/lib/actions/auth';
import { getStoreSettings } from '@/lib/store';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { StoreSettingsForm } from './StoreSettingsForm';

export const dynamic = 'force-dynamic';

export default async function StoreSettingsPage() {
  await requirePermission('settings.read');
  
  let settings;
  try {
    settings = await getStoreSettings();
  } catch {
    settings = {
      name: 'Prime Accessories Kenya',
      phone: '+254 700 000 000',
      email: 'hello@primeaccessorieskenya.co.ke',
      address: 'Nairobi, Kenya',
      currency: 'KES',
    };
  }

  return (
    <AdminPage 
      title="Store Settings" 
      description="Manage your store contact information and preferences."
    >
      <StoreSettingsForm settings={settings} />
    </AdminPage>
  );
}
