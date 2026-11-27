import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createRepositories, type ProductListItem } from '@repo/database';
import { serializeDecimals } from '@/lib/serialize';

/**
 * Short-lived shared cache for catalogue data that rarely changes and is safe
 * to store as JSON: categories, brands and site settings.
 *
 * Product lists are cached only for the homepage (see the bottom of this file),
 * for 30 seconds. Everywhere else, products are read live because their stock
 * must be current.
 *
 * Admin actions call `revalidateTag` with the tags below after every save, so
 * changes show at once. The 60 second `revalidate` is a safety net in case a
 * save path forgets to do so.
 */
export const CATALOG_TAG = 'catalog';
export const SETTINGS_TAG = 'settings';
const SAFETY_SECONDS = 60;

const repos = createRepositories();

export const getCachedRootCategories = unstable_cache(
  () => repos.category.findRootCategories(),
  ['root-categories'],
  { tags: [CATALOG_TAG], revalidate: SAFETY_SECONDS }
);

/** Category cards with cover photos, for the homepage and the header menu. */
export const getCachedCategoryCards = unstable_cache(
  () => repos.category.findCategoryCards(),
  ['category-cards'],
  { tags: [CATALOG_TAG], revalidate: SAFETY_SECONDS }
);

export const getCachedCategoryBySlug = cache((slug: string) =>
  unstable_cache(() => repos.category.findBySlug(slug), ['category-by-slug', slug], {
    tags: [CATALOG_TAG],
    revalidate: SAFETY_SECONDS,
  })());

export const getCachedActiveBrands = unstable_cache(
  () => repos.brand.findAllActive(),
  ['active-brands'],
  { tags: [CATALOG_TAG], revalidate: SAFETY_SECONDS }
);

export const getCachedBrandBySlug = cache((slug: string) =>
  unstable_cache(() => repos.brand.findBySlug(slug), ['brand-by-slug', slug], {
    tags: [CATALOG_TAG],
    revalidate: SAFETY_SECONDS,
  })());

export const getCachedSetting = cache((key: string) =>
  unstable_cache(() => repos.siteSetting.findByKey(key), ['site-setting', key], {
    tags: [SETTINGS_TAG],
    revalidate: SAFETY_SECONDS,
  })());

/**
 * Homepage product lists. These run on every visit and cost about 6 queries
 * each, so they are kept for 30 seconds. Prices are Decimal values and
 * unstable_cache stores JSON, so they are turned into plain numbers first;
 * the card formats both the same way. Saving a product in the admin clears
 * them straight away (CATALOG_TAG). Stock shown on a card can be up to 30
 * seconds old on the homepage only: adding to the cart still checks live stock.
 */
const HOME_PRODUCTS_SECONDS = 30;

const asProducts = (items: unknown): ProductListItem[] => items as ProductListItem[];

export const getCachedFeaturedProducts = unstable_cache(
  async () =>
    serializeDecimals(
      (await repos.product.findMany({ isFeatured: true, isActive: true, limit: 4 })).items
    ),
  ['home-featured-products'],
  { tags: [CATALOG_TAG], revalidate: HOME_PRODUCTS_SECONDS }
);

export const getCachedNewArrivals = unstable_cache(
  async () => serializeDecimals((await repos.product.findMany({ isActive: true, limit: 4 })).items),
  ['home-new-arrivals'],
  { tags: [CATALOG_TAG], revalidate: HOME_PRODUCTS_SECONDS }
);

export const getCachedBestSellers = unstable_cache(
  async () => serializeDecimals(await repos.product.findBestSelling(4)),
  ['home-best-sellers'],
  { tags: [CATALOG_TAG], revalidate: HOME_PRODUCTS_SECONDS }
);

/** The cached lists, typed as the cards expect them. */
export async function getHomeProducts(want: { featured: boolean; newArrivals: boolean; bestSellers: boolean }) {
  const [featured, newArrivals, bestSellers] = await Promise.all([
    want.featured ? getCachedFeaturedProducts() : Promise.resolve(null),
    want.newArrivals ? getCachedNewArrivals() : Promise.resolve(null),
    want.bestSellers ? getCachedBestSellers() : Promise.resolve(null),
  ]);
  return {
    featured: featured ? asProducts(featured) : null,
    newArrivals: newArrivals ? asProducts(newArrivals) : null,
    bestSellers: bestSellers ? asProducts(bestSellers) : null,
  };
}
