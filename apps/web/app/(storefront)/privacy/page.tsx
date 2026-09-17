import { PolicyPage } from '@/components/policy-page';
import { getStoreSettings } from '@/lib/store';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What personal information we collect, why we collect it, and your rights.',
};

export default async function PrivacyPage() {
  const store = await getStoreSettings();

  return (
    <PolicyPage
      title="Privacy policy"
      intro="What we collect, why we collect it, and what you can ask us to do with it."
    >
      <section className="space-y-3">
        <h2>What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name, phone number, email address and delivery address.</li>
          <li>Your order and payment history with us.</li>
          <li>
            Pseudonymous usage data about how the site is browsed: a randomly generated browser
            identifier lets us recognise repeat visits from the same browser, but it is not
            linked to your name or account. We only collect this if you accept tracking when
            asked, and you can decline.
          </li>
        </ul>
        <p>
          We never see or store your full card details or your M-Pesa PIN — those are handled by
          the payment provider.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Why we collect it</h2>
        <p>
          To process and deliver your orders, to contact you about an order, to handle returns, and
          to understand which products our customers are looking for.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Who we share it with</h2>
        <p>
          Only with the parties needed to complete your order: our delivery couriers, and our
          payment providers. We do not sell your personal information.
        </p>
      </section>

      <section className="space-y-3">
        <h2>Your rights</h2>
        <p>
          You can ask us for a copy of the information we hold about you, ask us to correct it, or
          ask us to delete your account. Note that we keep order records where the law requires it,
          even after an account is closed.
        </p>
        <p>
          To make a request, email {store.email} or call {store.phone}.
        </p>
      </section>
    </PolicyPage>
  );
}
