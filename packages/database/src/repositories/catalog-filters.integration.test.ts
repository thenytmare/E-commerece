/**
 * Shop filters against a real Postgres. Skipped unless DB_INTEGRATION=1.
 *   DB_INTEGRATION=1 pnpm --filter @repo/database test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../client';
import { ProductRepository } from './product.repository';

const run = process.env.DB_INTEGRATION === '1';
const tag = `filters-itest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const products = new ProductRepository(prisma);
const ids: Record<string, string> = {};

beforeAll(async () => {
  if (!run) return;
  for (const name of ['oraimo', 'jbl', 'anker']) {
    ids[name] = (await prisma.brand.create({ data: { name, slug: `${tag}-${name}` } })).id;
  }
  for (const name of ['audio', 'power']) {
    ids[name] = (await prisma.category.create({ data: { name, slug: `${tag}-${name}` } })).id;
  }
  const make = (slug: string, brand: string, category: string, price: number, active = true) =>
    prisma.product.create({
      data: { name: `${tag} ${slug}`, slug: `${tag}-${slug}`, basePrice: price, brandId: ids[brand]!, categoryId: ids[category]!, isActive: active },
    });
  await make('buds', 'oraimo', 'audio', 3000);
  await make('speaker', 'jbl', 'audio', 15000);
  await make('neckband', 'oraimo', 'audio', 2000);
  await make('bank', 'anker', 'power', 5000);
  await make('hidden', 'jbl', 'audio', 100, false);
});

afterAll(async () => {
  if (!run) return;
  await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.brand.deleteMany({ where: { slug: { startsWith: tag } } });
});

const names = (items: { name: string }[]) => items.map((p) => p.name.replace(`${tag} `, ''));

describe.skipIf(!run)('shop filters (real database)', () => {
  it('several brands at once, inside a category', async () => {
    const result = await products.findMany({ isActive: true, categoryId: ids.audio, brandIds: [ids.oraimo!, ids.jbl!], search: tag });
    expect(names(result.items).sort()).toEqual(['buds', 'neckband', 'speaker']);
  });

  it('sorts by price both ways', async () => {
    const low = await products.findMany({ isActive: true, search: tag, sort: 'price-asc' });
    const high = await products.findMany({ isActive: true, search: tag, sort: 'price-desc' });
    expect(names(low.items)).toEqual(['neckband', 'buds', 'bank', 'speaker']);
    expect(names(high.items)).toEqual(['speaker', 'bank', 'buds', 'neckband']);
  });

  it('counts each option without counting hidden products, and a brand count ignores the brand filter', async () => {
    const facets = await products.catalogFacets({ categoryId: ids.audio, brandIds: [ids.oraimo!], search: tag });
    // Brands within Audio: Oraimo 2, JBL 1 (the hidden JBL is not counted), even with Oraimo ticked.
    expect(facets.byBrand[ids.oraimo!]).toBe(2);
    expect(facets.byBrand[ids.jbl!]).toBe(1);
    expect(facets.byBrand[ids.anker!]).toBeUndefined();
    // Categories with Oraimo ticked: Audio 2, Power none.
    expect(facets.byCategory[ids.audio!]).toBe(2);
    expect(facets.byCategory[ids.power!]).toBeUndefined();
  });
});
