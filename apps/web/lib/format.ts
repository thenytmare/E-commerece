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

/** Calculate discount percentage between compare-at and sale price */
export function discountPercent(price: PriceInput, compareAt: PriceInput): number | null {
  const sale = toNumber(price);
  const original = toNumber(compareAt);
  if (original <= sale) {
    return null;
  }
  return Math.round(((original - sale) / original) * 100);
}
