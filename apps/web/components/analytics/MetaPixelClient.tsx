'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { COOKIE_CONSENT_EVENT, hasTrackingConsent } from '@/lib/cookie-consent';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/**
 * Loads the Meta Pixel, but only once the shopper has accepted the cookie
 * banner — the same consent gate `StorefrontTracker` uses. Kenya's Data
 * Protection Act requires opt-in before non-essential tracking starts, and
 * the pixel is exactly that kind of tracking.
 *
 * The bootstrap script carries the CSP nonce from the server (see
 * MetaPixel.tsx) so it's allowed to run under the strict script-src in
 * middleware.ts; the Facebook-hosted fbevents.js it then loads is trusted
 * via 'strict-dynamic', since a nonced script loaded it.
 */
export function MetaPixelClient({ pixelId, nonce }: { pixelId: string; nonce: string }) {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(hasTrackingConsent());
    const onConsentChange = () => setConsented(hasTrackingConsent());
    window.addEventListener('storage', onConsentChange);
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () => {
      window.removeEventListener('storage', onConsentChange);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    };
  }, []);

  // Track each client-side navigation as its own PageView once the pixel is
  // live — otherwise only the very first page load would ever be counted.
  useEffect(() => {
    if (consented && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname, consented]);

  if (!consented) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive" nonce={nonce}>
      {`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
