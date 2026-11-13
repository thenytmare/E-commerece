import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createRepositories } from '@repo/database';

/**
 * Short-lived shared cache for catalogue data that rarely changes and is safe
 * to store as JSON: categories, brands and site settings.
 *
 * Products are deliberately NOT cached here. Their prices are Decimal values
 * (unstable_cache stores JSON, which would turn them into strings) and their
 * stock must stay live.
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
