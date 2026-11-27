/**
 * Pull the M-Pesa confirmation code out of what a customer pasted on the
 * manual-payment page.
 *
 * Accepts either the code on its own or the full confirmation SMS. M-Pesa
 * receipt numbers are exactly 10 characters, start with a letter and always
 * mix letters and digits — the letter+digit test keeps a plain English word in
 * the message from being mistaken for a code. Returns the code in upper case,
 * or null when nothing in the text looks like one.
 */
export function extractMpesaCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase();
  const looksLikeCode = (t: string) =>
    t.length === 10 && /^[A-Z]/.test(t) && /[A-Z]/.test(t) && /\d/.test(t);

  if (looksLikeCode(cleaned)) return cleaned;
  for (const token of cleaned.split(/[^A-Z0-9]+/)) {
    if (looksLikeCode(token)) return token;
  }
  return null;
}
