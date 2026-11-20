import { PolicyPage } from '@/components/policy-page';
import { getStoreSettings } from '@/lib/store';
import {
  COUNTRY_LOCATIONS,
  COUNTY_LOCATIONS,
  FREE_SHIPPING_THRESHOLD_KES,
  NAIROBI_LOCATIONS,
  PICKUP_INFO,
  type DeliveryLocation,
} from '@repo/config';
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
          The delivery fee depends on where you are. Pick your area, county or country at checkout
          and the exact charge is shown before you pay. Delivery is free on orders of{' '}
          {formatPrice(FREE_SHIPPING_THRESHOLD_KES)} or more.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Shop pickup: free. {PICKUP_INFO.hours}, at {store.address}.
          </li>
          <li>Nairobi delivery: {feeRange(NAIROBI_LOCATIONS)}, depending on your area.</li>
          <li>Outside Nairobi: {feeRange(COUNTY_LOCATIONS)}, depending on your county.</li>
          <li>Outside Kenya (Uganda and Tanzania): {feeRange(COUNTRY_LOCATIONS)}.</li>
        </ul>
        <p>Cash on Delivery is available for Nairobi deliveries.</p>
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

function feeRange(locations: readonly DeliveryLocation[]): string {
  const fees = locations.map((entry) => entry.fee);
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  return min === max ? formatPrice(min) : `${formatPrice(min)} to ${formatPrice(max)}`;
}
