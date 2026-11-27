import { cache } from 'react';
import { createRepositories } from '@repo/database';

/**
 * Per-request de-duplication only (React `cache()`): the same product is read by
 * `generateMetadata` and by the page itself, and the rating summary by the page
 * and the reviews block. Nothing is kept between requests, so prices and stock
 * stay live.
 */
const repos = createRepositories();

export const getPublicProduct = cache((slug: string) => repos.product.findPublicBySlug(slug));
export const getRatingSummary = cache((productId: string) => repos.review.getRatingSummary(productId));
