/**
 * Shared constants/helpers for the cookie/tracking consent banner and the
 * analytics tracker it gates. Kept separate from both so neither component
 * has to import the other.
 */

export const COOKIE_CONSENT_KEY = 'cookie-consent';

/** Dispatched on `window` whenever the visitor makes a choice, so listeners
 * in the same tab can react immediately — a `storage` event only fires in
 * *other* tabs, never the one that made the change. */
export const COOKIE_CONSENT_EVENT = 'cookie-consent-change';

export type CookieConsentValue = 'accepted' | 'declined';

export function readCookieConsent(): CookieConsentValue | null {
  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return stored === 'accepted' || stored === 'declined' ? stored : null;
  } catch {
    // Private mode or blocked storage — treat as "no decision yet".
    return null;
  }
}

export function hasTrackingConsent(): boolean {
  return readCookieConsent() === 'accepted';
}
