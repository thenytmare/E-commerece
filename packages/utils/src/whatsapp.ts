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
  let digits = phone.replace(/\D/g, '');
  // Numbers are often saved the way people write them in Kenya (0712 345 678
  // or 712345678). wa.me needs the country code and no leading zero.
  if (digits.length === 10 && digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9 && /^[17]/.test(digits)) digits = `254${digits}`;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
