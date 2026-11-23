import { getPaymentConfig, isIntasendConfigured } from '@repo/config';

/**
 * IntaSend's "Secured by IntaSend Payments" badge.
 *
 * It only shows when the shop really takes payments through IntaSend with live
 * keys. In sandbox mode nobody is paying for real, so the badge stays hidden.
 *
 * IntaSend supplies two pictures: one for light pages and one for dark pages.
 * The page theme decides which one is visible. The pictures are loaded from
 * IntaSend's own address, as their embed code does.
 */
const BASE = 'https://intasend-prod-static.s3.amazonaws.com/img/trust-badges';
const ALT = 'IntaSend Secure Payments (PCI-DSS Compliant)';

export function IntasendBadge({ className = '', wide = false }: { className?: string; wide?: boolean }) {
  if (!isIntasendConfigured() || getPaymentConfig().intasendEnv !== 'live') return null;

  // `wide` stretches the badge across its container (the payment page).
  // Otherwise it stays small, for the footer.
  const size = 'w-full';

  return (
    <a
      href="https://intasend.com/security"
      target="_blank"
      rel="noopener noreferrer"
      className={`${wide ? 'block w-full' : 'inline-block'} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE}/intasend-trust-badge-with-mpesa-hr-light.png`}
        alt={ALT}
        width={375}
        loading="lazy"
        className={`h-auto ${size} dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE}/intasend-trust-badge-with-mpesa-hr-dark.png`}
        alt={ALT}
        width={375}
        loading="lazy"
        className={`hidden h-auto ${size} dark:block`}
      />
      <span className="mt-1 block text-center text-xs text-muted-foreground">Secured by IntaSend Payments</span>
    </a>
  );
}
