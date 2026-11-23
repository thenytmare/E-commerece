import { isPaystackConfigured } from '@repo/config';
import { getPaymentSettings } from '@/lib/payment-settings';

/**
 * "Secured by Paystack" badge with the card and M-Pesa logos.
 *
 * Only shows when the shop really takes Paystack payments: the keys are set
 * and the method is switched on in the admin panel.
 *
 * The picture has a see-through background and dark lettering, so it always
 * sits on a white card. Otherwise the words vanish in dark mode.
 */
export async function PaystackBadge({ className = '' }: { className?: string }) {
  if (!isPaystackConfigured()) return null;
  const { methods } = await getPaymentSettings();
  if (!methods.paystack) return null;

  return (
    <div className={`rounded-lg bg-white px-3 py-2 ${className}`}>
      <picture>
        <source srcSet="/images/secured-by-paystack.webp" type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/secured-by-paystack.png"
          alt="Secured by Paystack. We accept Mastercard, Visa and M-Pesa."
          width={1194}
          height={348}
          loading="lazy"
          className="h-auto w-full"
        />
      </picture>
    </div>
  );
}
