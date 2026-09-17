'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui';
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
  readCookieConsent,
  type CookieConsentValue,
} from '@/lib/cookie-consent';

/**
 * Cookie / tracking consent banner.
 *
 * We only ever store a browser identifier for analytics (see
 * `StorefrontTracker`), but Kenya's Data Protection Act still requires
 * opt-in consent before that tracking starts. Shown once — the choice is
 * persisted in localStorage — and dismissed by either button.
 */
export function CookieConsent() {
  // Rendered on the server, so it starts hidden and only appears after mount
  // once we know this browser hasn't already decided — never the other way
  // round, which would flash the banner at everyone who already chose.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readCookieConsent() === null);
  }, []);

  const choose = (value: CookieConsentValue) => {
    setVisible(false);
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
      window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    } catch {
      // Not persisting just means we ask again next visit — fine.
    }
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-card px-4 py-4 shadow-elevated sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We&apos;d like to use a randomly generated browser identifier to understand how the
          site is used. This only starts if you accept — see our{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('declined')}>
            Decline
          </Button>
          <Button variant="primary" size="sm" onClick={() => choose('accepted')}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
