import { formatPrice } from '@/lib/format';
import { FREE_SHIPPING_THRESHOLD_KES } from '@repo/config';
import { Container } from '@repo/ui';
import { RotateCcw, ShieldCheck, Truck, Wallet } from 'lucide-react';

/**
 * Four short promises under the homepage hero. Every line matches a policy
 * page on the site (shipping, returns), so change them together.
 */
export function TrustStrip() {
  const items = [
    { Icon: ShieldCheck, title: 'Genuine products', text: 'Original stock from trusted brands' },
    { Icon: Truck, title: 'Delivery across Kenya', text: `Free on orders over ${formatPrice(FREE_SHIPPING_THRESHOLD_KES)}` },
    { Icon: Wallet, title: 'Pay your way', text: 'M-Pesa or Nairobi cash on delivery' },
    { Icon: RotateCcw, title: 'Faulty item cover', text: 'Replaced or refunded if it arrives faulty' },
  ];

  return (
    <section aria-label="Why shop with us" className="border-b border-border">
      <Container>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-5 py-6 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {items.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
