type PriceInput = number | string | { toNumber(): number };

/** Convert Prisma Decimal or numeric string to a plain number */
export function toNumber(value: PriceInput): number {
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return value.toNumber();
  }
  return Number(value);
}

/** Format a price in Kenyan Shillings */
export function formatPrice(value: PriceInput): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

/**
 * The store's operating timezone.
 *
 * Every date the app renders is pinned to this. Without an explicit timezone,
 * `toLocaleDateString()` uses whatever the executing environment is set to —
 * the server's clock for Server Components, the shopper's for Client
 * Components — so an order placed at 12:30am EAT showed under the previous
 * calendar day on UTC-based hosting.
 */
export const STORE_TIME_ZONE = 'Africa/Nairobi';
const STORE_LOCALE = 'en-KE';

/** Format a date as a day, in store time. */
export function formatDate(value: Date | string | number): string {
  return new Intl.DateTimeFormat(STORE_LOCALE, {
    timeZone: STORE_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** Format a date and time, in store time. */
export function formatDateTime(value: Date | string | number): string {
  return new Intl.DateTimeFormat(STORE_LOCALE, {
    timeZone: STORE_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Calculate discount percentage between compare-at and sale price */
export function discountPercent(price: PriceInput, compareAt: PriceInput): number | null {
  const sale = toNumber(price);
  const original = toNumber(compareAt);
  if (original <= sale) {
    return null;
  }
  return Math.round(((original - sale) / original) * 100);
}
