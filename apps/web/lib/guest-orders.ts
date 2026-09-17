import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/**
 * Order access for guests.
 *
 * A guest has no account to scope their order lookup to, so proof of ownership
 * is carried in a signed cookie instead. Cookies are client-controlled, so
 * each order number is HMAC'd with AUTH_SECRET — a guest can read their own
 * order, but can't forge an entry for someone else's order number.
 */
const COOKIE_NAME = 'guest_orders';
const MAX_TRACKED = 10;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) {
    // auth.config.ts already fails fast on this; belt and braces.
    throw new Error('AUTH_SECRET is not set — cannot sign guest order tokens.');
  }
  return value;
}

function sign(orderNumber: string): string {
  return createHmac('sha256', secret()).update(orderNumber).digest('base64url');
}

function signatureMatches(orderNumber: string, provided: string): boolean {
  const expected = Buffer.from(sign(orderNumber));
  const actual = Buffer.from(provided);
  // timingSafeEqual throws on length mismatch, so length-check first.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Order numbers this browser has proven it placed. */
export async function readGuestOrderNumbers(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return [];

  return raw
    .split('.')
    .map((entry) => {
      const separator = entry.lastIndexOf('~');
      if (separator === -1) return null;
      const orderNumber = entry.slice(0, separator);
      const signature = entry.slice(separator + 1);
      return signatureMatches(orderNumber, signature) ? orderNumber : null;
    })
    .filter((value): value is string => value !== null);
}

export async function canAccessGuestOrder(orderNumber: string): Promise<boolean> {
  return (await readGuestOrderNumbers()).includes(orderNumber);
}

/** Record a freshly-placed guest order against this browser. */
export async function rememberGuestOrder(orderNumber: string): Promise<void> {
  const existing = await readGuestOrderNumbers();
  const next = [orderNumber, ...existing.filter((value) => value !== orderNumber)].slice(
    0,
    MAX_TRACKED
  );

  (await cookies()).set({
    name: COOKIE_NAME,
    value: next.map((value) => `${value}~${sign(value)}`).join('.'),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}
