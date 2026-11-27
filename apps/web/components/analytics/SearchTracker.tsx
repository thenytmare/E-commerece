'use client';

import { useEffect } from 'react';
import { trackSearch } from '@/lib/meta-pixel-events';

/**
 * Reports a Search event whenever the products page is opened with a search
 * term in the URL. Kept as its own tiny client component so the products
 * page itself can stay a server component.
 */
export function SearchTracker({ query }: { query?: string }) {
  useEffect(() => {
    if (query) trackSearch(query);
  }, [query]);

  return null;
}
