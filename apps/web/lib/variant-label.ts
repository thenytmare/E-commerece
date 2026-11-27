/**
 * Turns a variant's attributes into words a person can read, such as
 * "Colour: Black · Size: M".
 *
 * Used wherever an order line is shown (cart, checkout, order page, receipt,
 * admin and emails) so the customer and the person packing the order both see
 * which colour was chosen. The swatch hex code is for drawing only, so it is
 * left out.
 */
const NAMES: Record<string, string> = { color: 'Colour', colour: 'Colour' };

export function attributeName(key: string): string {
  return NAMES[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ');
}

export function variantLabel(attributes: unknown, separator = ' · '): string {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return '';
  return Object.entries(attributes as Record<string, unknown>)
    .filter(([key, value]) => key.toLowerCase() !== 'hex' && value != null && String(value).trim() !== '')
    .map(([key, value]) => `${attributeName(key)}: ${String(value).trim()}`)
    .join(separator);
}
