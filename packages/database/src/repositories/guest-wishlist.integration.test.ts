/**
 * Guest saved items against a real Postgres. Skipped unless DB_INTEGRATION=1.
 *   DB_INTEGRATION=1 pnpm --filter @repo/database test
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../client';
import { GUEST_WISHLIST_LIMIT, WishlistRepository } from './wishlist.repository';

const run = process.env.DB_INTEGRATION === '1';
const tag = `wish-itest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const wishlist = new WishlistRepository(prisma);

afterAll(async () => {
  if (!run) return;
  await prisma.wishlistItem.deleteMany({ where: { product: { slug: { startsWith: tag } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.brand.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe.skipIf(!run)('guest saved items (real database)', () => {
  it('saves for a guest, keeps guests apart, moves to the account at sign-in, and counts saves', async () => {
    const brand = await prisma.brand.create({ data: { name: 'B', slug: `${tag}-b` } });
    const category = await prisma.category.create({ data: { name: 'C', slug: `${tag}-c` } });
    const make = (slug: string, isActive = true) =>
      prisma.product.create({
        data: { name: slug, slug: `${tag}-${slug}`, basePrice: 100, brandId: brand.id, categoryId: category.id, isActive },
      });
    const [a, b, c, hidden] = await Promise.all([make('a'), make('b'), make('c'), make('hidden', false)]);
    const user = await prisma.user.create({ data: { email: `${tag}@example.com`, name: 'Shopper' } });
    const guest = { sessionId: `${tag}-guest` };
    const otherGuest = { sessionId: `${tag}-other` };

    // A guest saves two products; a repeat save is ignored.
    await wishlist.add(guest, a.id);
    await wishlist.add(guest, b.id);
    await wishlist.add(guest, b.id);
    expect((await wishlist.listProductIdsForOwner(guest)).sort()).toEqual([a.id, b.id].sort());
    expect(await wishlist.countForOwner(guest)).toBe(2);
    await expect(wishlist.add(guest, hidden.id)).rejects.toThrow(/no longer available/);

    // Another browser sees none of it.
    expect(await wishlist.has(otherGuest, a.id)).toBe(false);
    await wishlist.add(otherGuest, a.id);
    await wishlist.remove(otherGuest, a.id);
    expect(await wishlist.has(guest, a.id)).toBe(true);

    // The account already has B saved, so only A moves; no duplicate B.
    await wishlist.add(user.id, b.id);
    await wishlist.add(user.id, c.id);
    expect(await wishlist.mergeGuestIntoUser(guest.sessionId, user.id)).toBe(1);
    expect((await wishlist.listProductIdsForUser(user.id)).sort()).toEqual([a.id, b.id, c.id].sort());
    expect(await wishlist.countForOwner(guest)).toBe(0);
    expect(await prisma.wishlistItem.count({ where: { userId: user.id, productId: b.id } })).toBe(1);
    // Running it again is harmless.
    expect(await wishlist.mergeGuestIntoUser(guest.sessionId, user.id)).toBe(0);

    // Most saved: A by the customer and a guest, B and C by the customer only.
    await wishlist.add(otherGuest, a.id);
    const top = (await wishlist.mostSaved(50)).filter((row) => row.slug.startsWith(tag));
    expect(top[0]).toMatchObject({ productId: a.id, saves: 2, customerSaves: 1 });
    expect(top.map((row) => row.productId)).not.toContain(hidden.id);
    expect(top).toHaveLength(3);

    expect(GUEST_WISHLIST_LIMIT).toBe(100);
  });
});
