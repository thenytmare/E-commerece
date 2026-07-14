import type { Cart, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

const cartWithItemsInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: {
                where: { isFeatured: true },
                take: 1,
                orderBy: { sortOrder: 'asc' as const },
              },
            },
          },
          inventory: true,
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartWithItemsInclude }>;

const GUEST_CART_TTL_DAYS = 30;

/**
 * Data access for shopping carts (guest and authenticated).
 */
export class CartRepository extends BaseRepository {
  /** Find a user's cart with line items */
  findByUserId(userId: string): Promise<CartWithItems | null> {
    return this.db.cart.findFirst({
      where: { userId },
      include: cartWithItemsInclude,
    });
  }

  /** Find a guest cart by browser session ID */
  findBySessionId(sessionId: string): Promise<CartWithItems | null> {
    return this.db.cart.findFirst({
      where: {
        sessionId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: cartWithItemsInclude,
    });
  }

  /** Get or create a cart for an authenticated user */
  async getOrCreateForUser(userId: string): Promise<CartWithItems> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }

    return this.db.cart.create({
      data: { userId },
      include: cartWithItemsInclude,
    });
  }

  /** Get or create a guest cart tied to a browser session */
  async getOrCreateForSession(sessionId: string): Promise<CartWithItems> {
    const existing = await this.findBySessionId(sessionId);
    if (existing) {
      return existing;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + GUEST_CART_TTL_DAYS);

    return this.db.cart.create({
      data: { sessionId, expiresAt },
      include: cartWithItemsInclude,
    });
  }

  /** Merge a guest cart into a user cart after login */
  async mergeGuestIntoUser(sessionId: string, userId: string): Promise<CartWithItems> {
    const guestCart = await this.findBySessionId(sessionId);
    const userCart = await this.getOrCreateForUser(userId);

    if (!guestCart || guestCart.items.length === 0) {
      return userCart;
    }

    for (const item of guestCart.items) {
      await this.addItem(userCart.id, item.variantId, item.quantity);
    }

    await this.db.cart.delete({ where: { id: guestCart.id } });

    return this.loadCart(userCart.id);
  }

  /** Add a variant to the cart or increment its quantity */
  async addItem(cartId: string, variantId: string, quantity: number): Promise<CartWithItems> {
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    return this.db.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { variantId } });
      const available = inventory ? inventory.quantity - inventory.reserved : 0;

      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId, variantId } },
      });

      const newQuantity = (existing?.quantity ?? 0) + quantity;
      if (newQuantity > available) {
        throw new Error('Insufficient stock for this quantity');
      }

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId, variantId, quantity },
        });
      }

      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      });

      return tx.cart.findUniqueOrThrow({
        where: { id: cartId },
        include: cartWithItemsInclude,
      });
    });
  }

  /** Update line item quantity; removes the item when quantity is 0 */
  async updateItemQuantity(cartItemId: string, quantity: number): Promise<CartWithItems> {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    const cartItem = await this.db.cartItem.findUniqueOrThrow({
      where: { id: cartItemId },
    });

    if (quantity === 0) {
      return this.removeItem(cartItemId);
    }

    return this.db.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: cartItem.variantId },
      });
      const available = inventory ? inventory.quantity - inventory.reserved : 0;

      if (quantity > available) {
        throw new Error('Insufficient stock for this quantity');
      }

      await tx.cartItem.update({
        where: { id: cartItemId },
        data: { quantity },
      });

      await tx.cart.update({
        where: { id: cartItem.cartId },
        data: { updatedAt: new Date() },
      });

      return tx.cart.findUniqueOrThrow({
        where: { id: cartItem.cartId },
        include: cartWithItemsInclude,
      });
    });
  }

  /** Remove a line item from the cart */
  async removeItem(cartItemId: string): Promise<CartWithItems> {
    const cartItem = await this.db.cartItem.findUniqueOrThrow({
      where: { id: cartItemId },
    });

    await this.db.cartItem.delete({ where: { id: cartItemId } });
    await this.db.cart.update({
      where: { id: cartItem.cartId },
      data: { updatedAt: new Date() },
    });

    return this.loadCart(cartItem.cartId);
  }

  /** Total units across all line items */
  async countItems(cartId: string): Promise<number> {
    const result = await this.db.cartItem.aggregate({
      where: { cartId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  private loadCart(cartId: string): Promise<CartWithItems> {
    return this.db.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: cartWithItemsInclude,
    });
  }
}

export type { Cart };
