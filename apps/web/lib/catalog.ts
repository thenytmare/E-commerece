import { createRepositories } from '@repo/database';

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
  const page = Math.max(1, Number(params.page) || 1);

  const [category, brand] = await Promise.all([
    params.category ? repos.category.findBySlug(params.category) : null,
    params.brand ? repos.brand.findBySlug(params.brand) : null,
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
