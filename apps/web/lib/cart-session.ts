import { cookies } from 'next/headers';

export const CART_SESSION_COOKIE = 'cart_session_id';
const CART_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Read the guest cart session ID without creating one */
export async function getCartSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_SESSION_COOKIE)?.value;
}

/** Get or create a guest cart session ID cookie */
export async function ensureCartSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const sessionId = crypto.randomUUID();
  cookieStore.set(CART_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CART_SESSION_MAX_AGE,
    path: '/',
  });

  return sessionId;
}

/** Clear the guest cart session cookie after merge */
export async function clearCartSessionId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CART_SESSION_COOKIE);
}
