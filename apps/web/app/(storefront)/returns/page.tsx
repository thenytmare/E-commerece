import { PolicyPage } from '@/components/policy-page';
import { getStoreSettings } from '@/lib/store';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Returns & refunds',
  description: 'How to return an item and how refunds are processed.',
};

export default async function ReturnsPage() {
  const store = await getStoreSettings();

  return (
    <PolicyPage
      title="Returns & refunds"
      intro="What to do if something arrives faulty, damaged, or isn't what you expected."
    >
      <section className="space-y-3">
        <h2>Return window</h2>
        <p>
          You can return an item within 7 days of delivery, provided it is unused and in its
          original packaging with all accessories included.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Faulty or damaged items</h2>
        <p>
          If an item arrives faulty or damaged, contact us within 48 hours of delivery. We will
          arrange a replacement or a full refund, including delivery costs.
        </p>
      </section>

      <section className="space-y-3">
        <h2>How to start a return</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Contact us on {store.phone} or {store.email} with your order number.</li>
          <li>Tell us which item you are returning and why.</li>
          <li>We will confirm the return address and next steps.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2>Refunds</h2>
        <p>
          Approved refunds are sent back to the payment method you used. M-Pesa refunds usually
          arrive within 1–3 working days; card refunds can take up to 10 working days depending on
          your bank.
        </p>
      </section>

      <section className="space-y-3">
        <h2>What we can&apos;t accept</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Items with physical damage caused after delivery.</li>
          <li>Items missing their original packaging or accessories.</li>
          <li>Items returned more than 7 days after delivery.</li>
        </ul>
      </section>
    </PolicyPage>
  );
}
