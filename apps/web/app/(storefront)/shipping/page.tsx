import { PolicyPage } from '@/components/policy-page';
import { getStoreSettings } from '@/lib/store';
import { FLAT_SHIPPING_KES, FREE_SHIPPING_THRESHOLD_KES } from '@repo/config';
import { formatPrice } from '@/lib/format';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping & delivery',
  description: 'Delivery options, timings and shipping charges for orders across Kenya.',
};

export default async function ShippingPage() {
  const store = await getStoreSettings();

  return (
    <PolicyPage
      title="Shipping & delivery"
      intro="How and when your order reaches you, and what delivery costs."
    >
      <section className="space-y-3">
        <h2>Delivery charges</h2>
        <p>
          Delivery is {formatPrice(FLAT_SHIPPING_KES)} on orders below{' '}
          {formatPrice(FREE_SHIPPING_THRESHOLD_KES)}, and free on orders of{' '}
          {formatPrice(FREE_SHIPPING_THRESHOLD_KES)} or more. The exact charge is always shown at
          checkout before you pay.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Delivery times</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nairobi and surrounding areas: same day or next working day.</li>
          <li>Major towns: 1–3 working days.</li>
          <li>Other locations: 2–5 working days.</li>
        </ul>
        <p>
          Orders confirmed after 3pm are dispatched the following working day. We do not deliver on
          public holidays.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Tracking your order</h2>
        <p>
          Once your parcel is dispatched we add the courier and tracking number to your order. You
          can see them any time under your account&apos;s order history.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Questions about a delivery</h2>
        <p>
          Contact us on {store.phone} or email {store.email} with your order number and we will
          check on it for you.
        </p>
      </section>
    </PolicyPage>
  );
}
