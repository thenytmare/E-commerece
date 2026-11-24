'use client';

/**
 * Thin wrappers around `window.fbq` for the standard e-commerce events Meta
 * expects from a shop. Each is a no-op whenever the pixel hasn't loaded —
 * either because NEXT_PUBLIC_META_PIXEL_ID isn't set, or the shopper hasn't
 * accepted the cookie banner yet (see MetaPixelClient) — so callers never
 * need to check that themselves.
 */

function fbq(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

export function trackViewContent(input: {
  contentId: string;
  contentName: string;
  value: number;
  currency?: string;
}): void {
  fbq('track', 'ViewContent', {
    content_ids: [input.contentId],
    content_name: input.contentName,
    content_type: 'product',
    value: input.value,
    currency: input.currency ?? 'KES',
  });
}

export function trackSearch(searchString: string): void {
  if (!searchString.trim()) return;
  fbq('track', 'Search', { search_string: searchString });
}

export function trackAddToCart(input: {
  contentId: string;
  contentName: string;
  value: number;
  quantity: number;
  currency?: string;
}): void {
  fbq('track', 'AddToCart', {
    content_ids: [input.contentId],
    content_name: input.contentName,
    content_type: 'product',
    value: input.value * input.quantity,
    currency: input.currency ?? 'KES',
  });
}

export function trackInitiateCheckout(input: {
  contentIds: string[];
  value: number;
  numItems: number;
  currency?: string;
}): void {
  fbq('track', 'InitiateCheckout', {
    content_ids: input.contentIds,
    content_type: 'product',
    value: input.value,
    num_items: input.numItems,
    currency: input.currency ?? 'KES',
  });
}
