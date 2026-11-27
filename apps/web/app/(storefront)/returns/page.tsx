import { PolicyPage } from '@/components/policy-page';
import { getStoreSettings } from '@/lib/store';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Returns & refunds',
  description: 'Returns for faulty or wrong items, and how refunds are processed.',
};

export default async function ReturnsPage() {
  const store = await getStoreSettings();

  return (
    <PolicyPage
      title="Returns & refunds"
      intro="We accept returns only when an item arrives faulty or we send the wrong item."
    >
      <section className="space-y-3">
        <h2>When you can return an item</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>The item arrives faulty or does not work.</li>
          <li>The item arrives damaged.</li>
          <li>We sent the wrong item, colour or model.</li>
        </ul>
        <p>
          Tell us within 48 hours of delivery. We will replace the item or give you a full refund,
          including delivery costs.
        </p>
      </section>

      <section className="space-y-3">
        <h2>What we can&apos;t accept</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Change of mind. We do not take back an item because you no longer want it or chose the
            wrong one.
          </li>
          <li>
            Unused items that have been unboxed. Once a box is opened, we cannot sell the item as
            new again.
          </li>
          <li>Damage caused after delivery, such as drops, water or misuse.</li>
          <li>Faulty or wrong items reported more than 48 hours after delivery.</li>
          <li>Items sent back without their original box and accessories.</li>
        </ul>
        <p>Please check your order carefully before you open it.</p>
      </section>

      <section className="space-y-3">
        <h2>How to report a problem</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Contact us on {store.phone} or {store.email} with your order number.</li>
          <li>Tell us what is wrong. A photo or short video helps us sort it out faster.</li>
          <li>We will confirm the next steps and how to send the item back.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2>Refunds</h2>
        <p>
          Approved refunds are sent back by M-Pesa. They usually arrive within 1–3 working days.
        </p>
      </section>
    </PolicyPage>
  );
}
