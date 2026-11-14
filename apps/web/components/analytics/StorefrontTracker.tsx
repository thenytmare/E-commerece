'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { COOKIE_CONSENT_EVENT, hasTrackingConsent } from '@/lib/cookie-consent';

const VISITOR_KEY = 'storefront.visitorId';

export function StorefrontTracker() {
  const pathname = usePathname();
  // Tracks the visitor's cookie-consent choice so accepting the banner
  // starts tracking immediately, without requiring a page reload.
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(hasTrackingConsent());
    const onConsentChange = () => setConsented(hasTrackingConsent());
    // `storage` covers other tabs; the custom event covers this one, since
    // `storage` never fires in the tab that made the change.
    window.addEventListener('storage', onConsentChange);
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () => {
      window.removeEventListener('storage', onConsentChange);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    };
  }, []);

  useEffect(() => {
    if (!consented) return;
    let visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
    void fetch('/api/analytics/events', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ visitorId, path: pathname }),
    });
  }, [pathname, consented]);

  return null;
}
