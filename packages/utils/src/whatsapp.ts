/**
 * Builds a `wa.me` deep link that opens a WhatsApp chat, optionally
 * pre-filled with a message.
 *
 * `phone` is normalized to digits only — `wa.me` expects the full
 * international number with no `+`, spaces, or dashes. Previously each call
 * site sanitized (or didn't) this differently, so some links silently failed
 * to open for numbers that still had punctuation in them.
 *
 * @example
 *   buildWhatsAppLink('+254 700 000 000', 'Hi! I have a question')
 *   // => 'https://wa.me/254700000000?text=Hi!%20I%20have%20a%20question'
 *   buildWhatsAppLink('+254 700 000 000')
 *   // => 'https://wa.me/254700000000'
 */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
