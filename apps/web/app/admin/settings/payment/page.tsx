import { requirePermission } from '@/lib/actions/auth';
import { DEFAULT_METHOD_SWITCHES, getPaymentSettings } from '@/lib/payment-settings';
import {
  isIntasendConfigured,
  isMpesaConfigured,
  isPaystackConfigured,
  isStripeConfigured,
} from '@repo/config';
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
      methods: DEFAULT_METHOD_SWITCHES,
      manualMpesa: {
        enabled: false,
        businessName: '',
        paybillNumber: '',
        accountNumber: '',
        accountName: '',
        contactPhone: '',
        instructions: '',
      },
    };
  }

  return (
    <AdminPage
      title="Payment Settings"
      description="Choose which ways to pay customers see at checkout, and set up the M-Pesa Paybill."
    >
      <PaymentSettingsForm
        settings={settings}
        connected={{
          mpesaStk: isIntasendConfigured() || isMpesaConfigured(),
          card: isStripeConfigured(),
          paystack: isPaystackConfigured(),
        }}
      />
    </AdminPage>
  );
}
