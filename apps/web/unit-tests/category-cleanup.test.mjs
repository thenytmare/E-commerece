/**
 * Category clean-up against a real Postgres. Skipped unless DB_INTEGRATION=1:
 *   DB_INTEGRATION=1 DATABASE_URL=... pnpm test:web
 * Use a throwaway database: it creates the old categories and then cleans them up.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = process.env.DB_INTEGRATION === '1';
const { prisma } = run ? await import('@repo/database') : { prisma: null };
const cleanup = run ? await import('@/lib/admin/category-cleanup') : null;

const OLD = [
  'test', 'earbuds', 'smart-watches', 'chargers', 'power-banks', 'bluetooth-speakers', 'oraimo-powergan', 'earpods',
  'charging-solutions', 'oraimo-home-appliances', 'gaming-equipment', 'headphones', 'router-power-solutions',
  'cables-adapters', 'xiaomi-redmi-mi', 'soundcore-anker', 'wireless-powerbanks', 'open-ear-clip-buds', 'budi',
  'neck-bands', 'trimmers', 'power-station', 'open-ear', 'car-accessories', 'jbl', 'oraimo', 'others',
  'sandisc-external-storage', 'home-appliances', 'extensions', 'itel', 'electric-toothbrush', 'phone-holders',
];
const NAMED = [
  ['oraimo', 'Oraimo Powerdock (wireless Charger'], ['oraimo', 'oraimo ThermoGo 750ml Stainless Steel Insulated Thermos'],
  ['oraimo', 'Oraimo PowerHub 2 4-AC 3-USB Power Extension'], ['oraimo', 'oraimo Hotspot Elf 2 150Mbps 4G Mobile Hotspot'],
  ['oraimo', 'oraimo SmartKettle View 1.7L 304 Stainless Steel Electric Kettle'],
  ['others', 'Oraimo PowerSpark OJS-7100 (1500A/12V Jump Starter)'], ['others', '300W Multi-Port Car Power Converter for On-the-Go Power Needs'],
  ['jbl', 'JBL Charge 6'], ['jbl', 'JBL Flip 7'], ['itel', 'Itel Led Makeup Mirror Rechargeable Round Design'],
  ['budi', 'Budi iphone earphones (Half-in ear design)'], ['xiaomi-redmi-mi', 'Xiaomi Type-c Wired Earphones'],
  ['soundcore-anker', 'Anker Nano 45W Type C Super Fast Charger'], ['soundcore-anker', 'Anker High Speed 65W 3 in 1 Charger 3 Ports GaN'],
];

let n = 0;
const product = (categoryId, name) =>
  prisma.product.create({ data: { name, slug: `cleanup-test-${n++}`, basePrice: 100, brandId: 'cleanup-brand', categoryId } });

beforeAll(async () => {
  if (!run) return;
  await prisma.brand.create({ data: { id: 'cleanup-brand', name: 'Oraimo', slug: 'cleanup-brand' } });
  for (const [i, slug] of OLD.entries()) {
    await prisma.category.create({
      data: { id: `old-${slug}`, name: slug, slug, sortOrder: i, imageUrl: slug === 'earpods' ? '/uploads/earpods.jpg' : null },
    });
  }
  for (const slug of ['earbuds', 'earpods', 'headphones', 'chargers', 'power-banks', 'trimmers']) await product(`old-${slug}`, `Plain ${slug}`);
  for (const [from, name] of NAMED) await product(`old-${from}`, name);
});

afterAll(async () => {
  if (!run) return;
  await prisma.product.deleteMany({ where: { slug: { startsWith: 'cleanup-test-' } } });
  await prisma.category.deleteMany({});
  await prisma.brand.deleteMany({ where: { id: 'cleanup-brand' } });
});

describe.skipIf(!run)('category clean-up (real database)', () => {
  it('blocks saving while a product matches no rule, and changes nothing', async () => {
    const stray = await product('old-oraimo', 'Oraimo Mystery Gadget');
    let plan = await cleanup.planCategoryCleanup();
    expect(plan.unplaced).toEqual([{ product: 'Oraimo Mystery Gadget', from: 'oraimo' }]);
    await expect(cleanup.applyCategoryCleanup()).rejects.toThrow(/Mystery Gadget/);
    expect(await prisma.category.count({ where: { deletedAt: null } })).toBe(33);
    await prisma.product.delete({ where: { id: stray.id } });
    plan = await cleanup.planCategoryCleanup();
    expect(plan.unplaced).toEqual([]);
  });

  it('previews exactly what will happen, without changing anything', async () => {
    const plan = await cleanup.planCategoryCleanup();
    expect(plan.done).toBe(false);
    expect(plan.namedMoves).toHaveLength(14);
    expect(plan.removing).toHaveLength(29); // 33 old minus the 4 kept as they are
    const total = (slug) => plan.totals.find((t) => t.slug === slug).products;
    expect(total('earbuds-earphones')).toBe(4); // earbuds, earpods, Budi, Xiaomi
    expect(total('speakers')).toBe(2); // the two JBL
    expect(total('home-personal-care')).toBe(4); // trimmers, ThermoGo, SmartKettle, makeup mirror
    expect(await prisma.category.count({ where: { deletedAt: null } })).toBe(33);
  });

  it('saves it in one go: 11 categories, every product placed, old ones kept as deleted', async () => {
    const result = await cleanup.applyCategoryCleanup();
    expect(result.moved).toBe(18); // 4 whole-category products plus the 14 named ones
    const live = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } });
    expect(live.map((c) => c.name)).toEqual(cleanup.CLEANUP_TARGETS.map((t) => t.name));
    const flip = await prisma.product.findFirst({ where: { name: 'JBL Flip 7' }, include: { category: true } });
    expect(flip.category.slug).toBe('speakers');
    // The new category took the old Earpods picture.
    expect(live.find((c) => c.slug === 'earbuds-earphones').imageUrl).toBe('/uploads/earpods.jpg');
    expect(await prisma.category.count({ where: { deletedAt: { not: null } } })).toBe(29);
    expect(await prisma.product.count({ where: { category: { deletedAt: { not: null } } } })).toBe(0);
  });

  it('afterwards the page says it is done, and running again is harmless', async () => {
    expect((await cleanup.planCategoryCleanup()).done).toBe(true);
    const again = await cleanup.applyCategoryCleanup();
    expect(again).toEqual({ moved: 0, removed: 0, created: 0 });
  });

  it('matches names like the database ILIKE did', () => {
    expect(cleanup.likeToRegExp('JBL Flip 7%').test('jbl flip 7 portable')).toBe(true);
    expect(cleanup.likeToRegExp('%ThermoGo%').test('oraimo thermogo 750ml')).toBe(true);
    expect(cleanup.likeToRegExp('JBL Flip 7%').test('New JBL Flip 7')).toBe(false);
    expect(cleanup.likeToRegExp('Oraimo Powerdock%').test('Oraimo Powerdock (wireless Charger')).toBe(true);
  });
});
