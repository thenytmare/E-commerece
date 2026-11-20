import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Keeps crawlers out of the admin panel, API routes, and anything tied to a
 * particular shopper's session. There was no robots file at all before, so all
 * of that was fair game.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/account', '/cart', '/checkout', '/orders/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
