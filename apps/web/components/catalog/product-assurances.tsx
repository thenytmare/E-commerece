import { formatPrice } from '@/lib/format';
import { FREE_SHIPPING_THRESHOLD_KES } from '@repo/config';
import { RotateCcw, Truck, Wallet } from 'lucide-react';
import Link from 'next/link';

/**
 * Delivery, returns and payment, beside the buy buttons on a product page.
 * The wording follows the Shipping and Returns pages, so change them together.
 */
export function ProductAssurances() {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border text-sm">
      <li className="flex items-start gap-3 p-3">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          Nairobi delivery is same day or next working day. Free over {formatPrice(FREE_SHIPPING_THRESHOLD_KES)}.{' '}
          <Link href="/shipping" className="underline underline-offset-2 hover:text-primary">
            Delivery details
          </Link>
        </span>
      </li>
      <li className="flex items-start gap-3 p-3">
        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          Return unused items within 7 days.{' '}
          <Link href="/returns" className="underline underline-offset-2 hover:text-primary">
            Returns policy
          </Link>
        </span>
      </li>
      <li className="flex items-start gap-3 p-3">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>Pay by M-Pesa. Cash on delivery in Nairobi.</span>
      </li>
    </ul>
  );
}
