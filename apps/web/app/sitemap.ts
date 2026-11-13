import type { MetadataRoute } from 'next';
import { createRepositories } from '@repo/database';

// Query the deployed catalog at request time, not an unavailable build database.
export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Sitemap covering the static pages plus every active product and category.
 *
 * Only active, non-deleted records are listed — the same rule the storefront
 * queries apply — so a deactivated product isn't advertised to crawlers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repos = createRepositories();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/shipping`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/returns`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const categories = await repos.category.findRootCategories();

    // The repository caps each page at 100, so walk every page. A sitemap file
    // holds up to 50,000 URLs, far more than this shop will have.
    const productItems: Awaited<ReturnType<typeof repos.product.findMany>>['items'] = [];
    for (let page = 1; page <= 500; page++) {
      const result = await repos.product.findMany({ isActive: true, limit: 100, page });
      productItems.push(...result.items);
      if (page >= result.totalPages) break;
    }

    return [
      ...staticRoutes,
      ...categories.map((category) => ({
        url: `${baseUrl}/categories/${category.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...productItems.map((product) => ({
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    // A database hiccup shouldn't produce a 500 for crawlers — serve what we
    // can describe without querying.
    console.error('Sitemap generation failed, serving static routes only:', error);
    return staticRoutes;
  }
}
