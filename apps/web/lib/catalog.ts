import { createRepositories, type CatalogSort } from '@repo/database';
import { getCachedActiveBrands, getCachedCategoryBySlug, getCachedRootCategories } from '@/lib/catalog-cache';

/** Shared repository instance for server components and actions */
export function getCatalogRepos() {
  return createRepositories();
}

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  /** One brand slug, or several separated by commas: "oraimo,jbl". */
  brand?: string;
  page?: string;
  featured?: string;
  sort?: string;
}

export const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

function parseSort(value: string | undefined): CatalogSort {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as CatalogSort) : 'newest';
}

/** Brand slugs from the address, cleaned: at most 20, no blanks or repeats. */
export function parseBrandSlugs(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((slug) => slug.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export async function resolveCatalogFilters(params: CatalogSearchParams) {
  const parsedPage = Number.parseInt(params.page ?? '', 10);
  // A finite whole number between 1 and 10,000. Anything else (Infinity, NaN,
  // negatives, huge values) falls back to page 1 instead of reaching the database.
  const page = Number.isSafeInteger(parsedPage) ? Math.min(10_000, Math.max(1, parsedPage)) : 1;

  const brandSlugs = parseBrandSlugs(params.brand);
  const [category, brands] = await Promise.all([
    params.category ? getCachedCategoryBySlug(params.category) : null,
    brandSlugs.length > 0 ? getCachedActiveBrands() : Promise.resolve([]),
  ]);
  const activeBrands = brands.filter((brand) => brandSlugs.includes(brand.slug));

  return {
    categoryId: category?.id,
    brandIds: activeBrands.map((brand) => brand.id),
    /** Kept for older callers: the first chosen brand, if any. */
    brandId: activeBrands[0]?.id,
    category,
    brands: activeBrands,
    brand: activeBrands[0] ?? null,
    search: params.q?.trim() || undefined,
    isFeatured: params.featured === 'true' ? true : undefined,
    sort: parseSort(params.sort),
    page,
  };
}

/**
 * Everything a product list page needs: the products, and the categories and
 * brands for the filter panel with how many products each has.
 * `fixedCategorySlug` is set on a category page.
 */
export async function loadCatalogPage(params: CatalogSearchParams, fixedCategorySlug?: string) {
  const repos = getCatalogRepos();
  const filters = await resolveCatalogFilters({ ...params, category: fixedCategorySlug ?? params.category });

  const [rootCategories, allBrands, catalog, facets] = await Promise.all([
    getCachedRootCategories(),
    getCachedActiveBrands(),
    repos.product.findMany({
      categoryId: filters.categoryId,
      brandIds: filters.brandIds,
      search: filters.search,
      isFeatured: filters.isFeatured,
      // Deactivated products must never appear on the storefront.
      isActive: true,
      page: filters.page,
      sort: filters.sort,
    }),
    repos.product.catalogFacets({
      categoryId: filters.categoryId,
      brandIds: filters.brandIds,
      search: filters.search,
    }),
  ]);

  const activeBrandSlugs = filters.brands.map((brand) => brand.slug);
  const categories = rootCategories
    .map((category) => ({ slug: category.slug, name: category.name, count: facets.byCategory[category.id] ?? 0 }))
    // Hide categories with nothing to show, but never the one being viewed.
    .filter((category) => category.count > 0 || category.slug === filters.category?.slug);
  const brands = allBrands
    .map((brand) => ({ slug: brand.slug, name: brand.name, count: facets.byBrand[brand.id] ?? 0 }))
    .filter((brand) => brand.count > 0 || activeBrandSlugs.includes(brand.slug))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { filters, catalog, categories, brands, activeBrandSlugs };
}

