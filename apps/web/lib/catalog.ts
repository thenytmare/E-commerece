import { createRepositories } from '@repo/database';
import { getCachedActiveBrands, getCachedBrandBySlug, getCachedCategoryBySlug, getCachedRootCategories } from '@/lib/catalog-cache';

/** Shared repository instance for server components and actions */
export function getCatalogRepos() {
  return createRepositories();
}

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  brand?: string;
  page?: string;
  featured?: string;
}

export async function resolveCatalogFilters(params: CatalogSearchParams) {
  const repos = getCatalogRepos();
  const parsedPage = Number.parseInt(params.page ?? '', 10);
  // A finite whole number between 1 and 10,000. Anything else (Infinity, NaN,
  // negatives, huge values) falls back to page 1 instead of reaching the database.
  const page = Number.isSafeInteger(parsedPage) ? Math.min(10_000, Math.max(1, parsedPage)) : 1;

  const [category, brand] = await Promise.all([
    params.category ? getCachedCategoryBySlug(params.category) : null,
    params.brand ? getCachedBrandBySlug(params.brand) : null,
  ]);

  return {
    categoryId: category?.id,
    brandId: brand?.id,
    category,
    brand,
    search: params.q?.trim() || undefined,
    isFeatured: params.featured === 'true' ? true : undefined,
    page,
  };
}
