import { requirePermission } from '@/lib/actions/auth';
import { getPaymentSettings } from '@/lib/payment-settings';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { PaymentSettingsForm } from './PaymentSettingsForm';

export const dynamic = 'force-dynamic';

export default async function PaymentSettingsPage() {
  await requirePermission('settings.read');

  let settings;
  try {
    settings = await getPaymentSettings();
  } catch {
    settings = {
      manualMpesa: {
        enabled: false,
        businessName: '',
        paybillNumber: '',
        accountNumber: '',
        contactPhone: '',
        instructions: '',
      },
    };
  }

  return (
    <AdminPage
      title="Payment Settings"
      description="Set up the M-Pesa Paybill shown to customers at checkout. Payments are confirmed by hand until a payment gateway is connected."
    >
      <PaymentSettingsForm settings={settings} />
    </AdminPage>
  );
}
