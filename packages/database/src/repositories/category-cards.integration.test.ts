/**
 * Category cards against a real Postgres. Skipped unless DB_INTEGRATION=1.
 *   DB_INTEGRATION=1 pnpm --filter @repo/database test
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../client';
import { CategoryRepository } from './category.repository';

const run = process.env.DB_INTEGRATION === '1';
const tag = `cards-itest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const categories = new CategoryRepository(prisma);

afterAll(async () => {
  if (!run) return;
  await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.brand.deleteMany({ where: { slug: { startsWith: tag } } });
});

describe.skipIf(!run)('category cards (real database)', () => {
  it('picks the right cover, counts only visible products, and leaves out empty categories', async () => {
    const brand = await prisma.brand.create({ data: { name: 'B', slug: `${tag}-brand` } });
    const make = (slug: string, imageUrl: string | null = null) =>
      prisma.category.create({ data: { name: slug, slug: `${tag}-${slug}`, imageUrl } });
    const product = (categoryId: string, slug: string, opts: { active?: boolean; featured?: boolean; image?: string } = {}) =>
      prisma.product.create({
        data: {
          name: slug,
          slug: `${tag}-${slug}`,
          basePrice: 100,
          brandId: brand.id,
          categoryId,
          isActive: opts.active ?? true,
          isFeatured: opts.featured ?? false,
          images: opts.image ? { create: { url: opts.image } } : undefined,
        },
      });

    const ownPhoto = await make('own', '/uploads/own.jpg');
    await product(ownPhoto.id, 'own-1', { image: '/p/own-product.jpg' });

    const fromProduct = await make('from-product');
    await product(fromProduct.id, 'hidden', { active: false, featured: true, image: '/p/hidden.jpg' });
    await product(fromProduct.id, 'plain', { image: '/p/plain.jpg' });
    await product(fromProduct.id, 'featured', { featured: true, image: '/p/featured.jpg' });
    await product(fromProduct.id, 'no-photo');

    const noPhotos = await make('no-photos');
    await product(noPhotos.id, 'bare');

    const onlyHidden = await make('only-hidden');
    await product(onlyHidden.id, 'gone', { active: false, image: '/p/gone.jpg' });

    await make('empty');

    const cards = (await categories.findCategoryCards()).filter((c) => c.slug.startsWith(tag));
    const bySlug = Object.fromEntries(cards.map((c) => [c.slug.slice(tag.length + 1), c]));

    expect(bySlug.own?.coverUrl).toBe('/uploads/own.jpg');
    expect(bySlug.own?.hasOwnImage).toBe(true);
    expect(bySlug['from-product']?.hasOwnImage).toBe(false);
    // Featured visible product wins; the hidden featured one is never shown.
    expect(bySlug['from-product']?.coverUrl).toBe('/p/featured.jpg');
    expect(bySlug['from-product']?.productCount).toBe(3);
    expect(bySlug['no-photos']?.coverUrl).toBeNull();
    expect(bySlug['no-photos']?.productCount).toBe(1);
    expect(bySlug['only-hidden']).toBeUndefined();
    expect(bySlug.empty).toBeUndefined();
  });
});
