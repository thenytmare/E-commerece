import { prisma, type Prisma } from '@repo/database';

/**
 * One-off category clean-up: 33 categories down to 11.
 *
 * The same rules as scripts/category-cleanup-2026-11.sql, so the admin can run
 * it from a page instead of a database terminal. `planCategoryCleanup` only
 * reads. `applyCategoryCleanup` re-plans inside a transaction and applies it,
 * so what is saved always matches the latest preview.
 */

export const CLEANUP_TARGETS = [
  { slug: 'earbuds-earphones', name: 'Earbuds & Earphones', sort: 1 },
  { slug: 'headphones', name: 'Headphones', sort: 2 },
  { slug: 'speakers', name: 'Speakers', sort: 3 },
  { slug: 'smart-watches', name: 'Smart Watches', sort: 4 },
  { slug: 'power-banks', name: 'Power Banks', sort: 5 },
  { slug: 'chargers-cables', name: 'Chargers & Cables', sort: 6 },
  { slug: 'power-solutions', name: 'Power Solutions', sort: 7 },
  { slug: 'storage', name: 'Storage', sort: 8 },
  { slug: 'gaming-equipment', name: 'Gaming Equipment', sort: 9 },
  { slug: 'phone-car-accessories', name: 'Phone & Car Accessories', sort: 10 },
  { slug: 'home-personal-care', name: 'Home & Personal Care', sort: 11 },
] as const;

type TargetSlug = (typeof CLEANUP_TARGETS)[number]['slug'];

/** Old category → new category. Every product in it moves. */
export const CLEANUP_MERGES: Record<string, TargetSlug> = {
  earbuds: 'earbuds-earphones',
  earpods: 'earbuds-earphones',
  'open-ear': 'earbuds-earphones',
  'open-ear-clip-buds': 'earbuds-earphones',
  'neck-bands': 'earbuds-earphones',
  'bluetooth-speakers': 'speakers',
  'wireless-powerbanks': 'power-banks',
  chargers: 'chargers-cables',
  'charging-solutions': 'chargers-cables',
  'cables-adapters': 'chargers-cables',
  'oraimo-powergan': 'chargers-cables',
  'power-station': 'power-solutions',
  'router-power-solutions': 'power-solutions',
  extensions: 'power-solutions',
  'sandisc-external-storage': 'storage',
  'car-accessories': 'phone-car-accessories',
  'phone-holders': 'phone-car-accessories',
  'home-appliances': 'home-personal-care',
  'oraimo-home-appliances': 'home-personal-care',
  trimmers: 'home-personal-care',
  'electric-toothbrush': 'home-personal-care',
};

/** Brand and catch-all categories: each product is placed by its name. */
export const CLEANUP_MIXED: { from: string; match: string; to: TargetSlug }[] = [
  { from: 'oraimo', match: 'Oraimo Powerdock%', to: 'chargers-cables' },
  { from: 'oraimo', match: '%ThermoGo%', to: 'home-personal-care' },
  { from: 'oraimo', match: '%PowerHub 2%', to: 'power-solutions' },
  { from: 'oraimo', match: '%Hotspot Elf%', to: 'phone-car-accessories' },
  { from: 'oraimo', match: '%SmartKettle%', to: 'home-personal-care' },
  { from: 'others', match: '%PowerSpark%', to: 'phone-car-accessories' },
  { from: 'others', match: '300W Multi-Port Car Power Converter%', to: 'phone-car-accessories' },
  { from: 'jbl', match: 'JBL Charge 6%', to: 'speakers' },
  { from: 'jbl', match: 'JBL Flip 7%', to: 'speakers' },
  { from: 'itel', match: 'Itel Led Makeup Mirror%', to: 'home-personal-care' },
  { from: 'budi', match: 'Budi iphone earphones%', to: 'earbuds-earphones' },
  { from: 'xiaomi-redmi-mi', match: 'Xiaomi Type-c Wired Earphones%', to: 'earbuds-earphones' },
  { from: 'soundcore-anker', match: 'Anker Nano 45W%', to: 'chargers-cables' },
  { from: 'soundcore-anker', match: 'Anker High Speed 65W%', to: 'chargers-cables' },
];

export const CLEANUP_MIXED_SOURCES = ['oraimo', 'others', 'jbl', 'itel', 'budi', 'xiaomi-redmi-mi', 'soundcore-anker', 'test'];

const TARGET_SLUGS = new Set<string>(CLEANUP_TARGETS.map((t) => t.slug));
const OLD_SLUGS = [...new Set([...Object.keys(CLEANUP_MERGES), ...CLEANUP_MIXED_SOURCES])].filter(
  (slug) => !TARGET_SLUGS.has(slug)
);

/** SQL LIKE pattern (only % used) to a case-insensitive test, like ILIKE. */
export function likeToRegExp(pattern: string): RegExp {
  const body = pattern
    .split('%')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}$`, 'i');
}

export type CleanupMove = { productId: string; product: string; brand: string; from: string; to: TargetSlug };

export type CleanupPlan = {
  /** Nothing left to do: none of the old categories are still in use. */
  done: boolean;
  /** Products per new category once applied. */
  totals: { slug: string; name: string; products: number; exists: boolean }[];
  /** Products coming out of brand and catch-all categories, one by one. */
  namedMoves: CleanupMove[];
  /** How many products move as part of a whole category. */
  mergedCount: number;
  /** Products in brand or catch-all categories that match no rule. Saving is blocked while any remain. */
  unplaced: { product: string; from: string }[];
  /** Old categories that will be removed (kept as deleted, not erased). */
  removing: string[];
  /** Brand on products that came from a brand category, to check. */
  brandCheck: { from: string; brand: string; products: number }[];
};

type Db = Prisma.TransactionClient | typeof prisma;

async function buildPlan(db: Db): Promise<CleanupPlan & { moves: CleanupMove[] }> {
  const categories = await db.category.findMany({
    where: { slug: { in: [...OLD_SLUGS, ...TARGET_SLUGS] }, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const oldIds = categories.filter((c) => !TARGET_SLUGS.has(c.slug)).map((c) => c.id);

  const products = oldIds.length
    ? await db.product.findMany({
        where: { categoryId: { in: oldIds } },
        select: { id: true, name: true, categoryId: true, brand: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
    : [];

  const slugOfId = new Map(categories.map((c) => [c.id, c.slug]));
  const nameOfSlug = (slug: string) => bySlug.get(slug)?.name ?? slug;
  const moves: CleanupMove[] = [];
  const unplaced: CleanupPlan['unplaced'] = [];
  let mergedCount = 0;

  for (const product of products) {
    const from = slugOfId.get(product.categoryId)!;
    const merge = CLEANUP_MERGES[from];
    if (merge) {
      moves.push({ productId: product.id, product: product.name, brand: product.brand.name, from, to: merge });
      mergedCount += 1;
      continue;
    }
    const rule = CLEANUP_MIXED.find((r) => r.from === from && likeToRegExp(r.match).test(product.name));
    if (rule) moves.push({ productId: product.id, product: product.name, brand: product.brand.name, from, to: rule.to });
    else unplaced.push({ product: product.name, from: nameOfSlug(from) });
  }

  // Products already in a kept category stay there.
  const keptIds = CLEANUP_TARGETS.map((t) => bySlug.get(t.slug)?.id).filter((id): id is string => Boolean(id));
  const keptCounts = keptIds.length
    ? await db.product.groupBy({ by: ['categoryId'], where: { categoryId: { in: keptIds } }, _count: { _all: true } })
    : [];
  const keptCountBySlug = new Map(keptCounts.map((row) => [slugOfId.get(row.categoryId)!, row._count._all]));

  const totals = CLEANUP_TARGETS.map((t) => ({
    slug: t.slug,
    name: t.name,
    exists: bySlug.has(t.slug),
    products: (keptCountBySlug.get(t.slug) ?? 0) + moves.filter((m) => m.to === t.slug).length,
  }));

  const brandSources = new Set(['jbl', 'itel', 'budi', 'xiaomi-redmi-mi', 'soundcore-anker', 'sandisc-external-storage']);
  const brandCounts = new Map<string, number>();
  for (const move of moves.filter((m) => brandSources.has(m.from))) {
    const key = `${nameOfSlug(move.from)}\u0000${move.brand}`;
    brandCounts.set(key, (brandCounts.get(key) ?? 0) + 1);
  }

  const removing = OLD_SLUGS.filter((slug) => bySlug.has(slug)).map(nameOfSlug);

  return {
    done: removing.length === 0,
    totals,
    moves,
    namedMoves: moves
      .filter((m) => !CLEANUP_MERGES[m.from])
      .map((m) => ({ ...m, from: nameOfSlug(m.from) })),
    mergedCount,
    unplaced,
    removing,
    brandCheck: [...brandCounts.entries()].map(([key, products]) => {
      const [from, brand] = key.split('\u0000') as [string, string];
      return { from, brand, products };
    }),
  };
}

/** Read-only preview. */
export async function planCategoryCleanup(): Promise<CleanupPlan> {
  const plan = await buildPlan(prisma);
  return {
    done: plan.done,
    totals: plan.totals,
    namedMoves: plan.namedMoves,
    mergedCount: plan.mergedCount,
    unplaced: plan.unplaced,
    removing: plan.removing,
    brandCheck: plan.brandCheck,
  };
}

export class CleanupBlockedError extends Error {}

/**
 * Applies the clean-up in one transaction: all of it, or nothing.
 * Refuses while any product would be left without a category.
 */
export async function applyCategoryCleanup(): Promise<{ moved: number; removed: number; created: number }> {
  return prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx);
      if (plan.unplaced.length > 0) {
        throw new CleanupBlockedError(
          `These products have no new category yet: ${plan.unplaced.map((u) => `${u.product} (in ${u.from})`).join('; ')}`
        );
      }

      // 1. Make sure all 11 categories exist, visible, named and ordered.
      let created = 0;
      const ids = new Map<string, string>();
      for (const target of CLEANUP_TARGETS) {
        const existing = await tx.category.findUnique({ where: { slug: target.slug }, select: { id: true } });
        if (existing) {
          await tx.category.update({
            where: { id: existing.id },
            data: { name: target.name, sortOrder: target.sort, isActive: true, deletedAt: null, parentId: null },
          });
          ids.set(target.slug, existing.id);
        } else {
          // A new category takes the picture of the first old category in its group that has one.
          const sources = Object.entries(CLEANUP_MERGES)
            .filter(([, to]) => to === target.slug)
            .map(([from]) => from);
          const withImage = await tx.category.findFirst({
            where: { slug: { in: sources }, deletedAt: null, imageUrl: { not: null } },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { imageUrl: true },
          });
          const row = await tx.category.create({
            data: { name: target.name, slug: target.slug, sortOrder: target.sort, isActive: true, imageUrl: withImage?.imageUrl ?? null },
            select: { id: true },
          });
          ids.set(target.slug, row.id);
          created += 1;
        }
      }

      // 2. Move every product, grouped by destination.
      for (const target of CLEANUP_TARGETS) {
        const productIds = plan.moves.filter((m) => m.to === target.slug).map((m) => m.productId);
        if (productIds.length) {
          await tx.product.updateMany({ where: { id: { in: productIds } }, data: { categoryId: ids.get(target.slug)! } });
        }
      }

      // 3. Safety check, then retire the old categories (kept as deleted, not erased).
      const leftOver = await tx.product.count({ where: { category: { slug: { in: OLD_SLUGS }, deletedAt: null } } });
      if (leftOver > 0) throw new CleanupBlockedError(`${leftOver} products are still in old categories. Nothing was changed.`);
      const removed = await tx.category.updateMany({
        where: { slug: { in: OLD_SLUGS }, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });

      return { moved: plan.moves.length, removed: removed.count, created };
    },
    { timeout: 60_000 }
  );
}
