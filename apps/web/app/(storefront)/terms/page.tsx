import { PolicyPage } from '@/components/policy-page';
import { getStoreSettings } from '@/lib/store';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of sale',
  description: 'The terms that apply when you buy from us.',
};

export default async function TermsPage() {
  const store = await getStoreSettings();

  return (
    <PolicyPage
      title="Terms of sale"
      intro={`The terms that apply when you place an order with ${store.name}.`}
    >
      <section className="space-y-3">
        <h2>Orders</h2>
        <p>
          Placing an order is an offer to buy. A contract is formed once we confirm your payment.
          If we cannot fulfil an order — for example an item sells out before payment completes —
          we will contact you and refund you in full.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Pricing</h2>
        <p>
          All prices are in Kenyan Shillings and include applicable taxes. Delivery is charged
          separately and shown at checkout. We may change prices at any time, but never after your
          order is confirmed.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Payment</h2>
        <p>
          We accept M-Pesa and major debit and credit cards. Your order is only confirmed once
          payment has cleared. Stock is held for you while payment is being completed.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Warranty</h2>
        <p>
          Products carry the manufacturer&apos;s warranty where one is offered. Warranty claims are
          handled through us — keep your order number as proof of purchase.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Contact</h2>
        <p>
          {store.name}, {store.address}. Phone {store.phone}, email {store.email}.
        </p>
      </section>
    </PolicyPage>
  );
}
