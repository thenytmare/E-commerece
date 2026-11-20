import { createHash, randomBytes } from 'crypto';

/**
 * Shared by password reset and staff invites. Both use the same link and the
 * same "choose a password" page, so the token format must match exactly.
 */

/** Namespaced so these can't collide with any other verification token. */
export const RESET_IDENTIFIER_PREFIX = 'password-reset:';

/**
 * Only the hash is stored. A stolen database snapshot then yields no usable
 * links, the same reasoning that applies to password hashes themselves.
 */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A fresh random token and the link that carries it. */
export function newResetLink(email: string): { token: string; url: string } {
  const token = randomBytes(32).toString('base64url');
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return { token, url: `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}` };
}
