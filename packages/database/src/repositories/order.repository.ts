import {
  DEFAULT_CURRENCY,
  FLAT_SHIPPING_KES,
  FREE_SHIPPING_THRESHOLD_KES,
} from '@repo/config';
import type { Order, OrderStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { BaseRepository } from './base.repository';
import type { CartWithItems } from './cart.repository';

const orderDetailInclude = {
  items: {
    include: {
      product: true,
      variant: true,
    },
    orderBy: { id: 'asc' as const },
  },
  address: true,
  payments: {
    orderBy: { createdAt: 'desc' as const },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export interface CreateOrderInput {
  cart: CartWithItems;
  userId: string;
  addressId: string;
  notes?: string;
}

/**
 * Data access for orders and checkout.
 */
export class OrderRepository extends BaseRepository {
  /** Find an order by its public order number */
  findByOrderNumber(orderNumber: string): Promise<OrderDetail | null> {
    return this.db.order.findUnique({
      where: { orderNumber },
      include: orderDetailInclude,
    });
  }

  /** Find an order owned by a user */
  findByOrderNumberForUser(orderNumber: string, userId: string): Promise<OrderDetail | null> {
    return this.db.order.findFirst({
      where: { orderNumber, userId },
      include: orderDetailInclude,
    });
  }

  /** List orders for a user, newest first */
  listByUserId(userId: string, limit = 20): Promise<OrderDetail[]> {
    return this.db.order.findMany({
      where: { userId },
      include: orderDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** List orders across all customers for admin screens */
  listAll(limit = 50): Promise<OrderDetail[]> {
    return this.db.order.findMany({
      include: orderDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Create an order from a cart, reserve stock, and clear the cart */
  async createFromCart(input: CreateOrderInput): Promise<OrderDetail> {
    const { cart, userId, addressId, notes } = input;

    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    const address = await this.db.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new Error('Invalid shipping address');
    }

    const subtotal = this.calculateSubtotal(cart);
    const shipping = this.calculateShipping(subtotal);
    const discount = 0;
    const tax = 0;
    const total = subtotal + shipping + tax - discount;

    return this.db.$transaction(async (tx) => {
      for (const item of cart.items) {
        const inventory = await tx.inventory.findUnique({
          where: { variantId: item.variantId },
        });
        const available = inventory ? inventory.quantity - inventory.reserved : 0;
        if (available < item.quantity) {
          throw new Error(`Insufficient stock for ${item.variant.product.name}`);
        }
      }

      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId,
          status: 'PENDING',
          subtotal: new PrismaNamespace.Decimal(subtotal),
          discount: new PrismaNamespace.Decimal(discount),
          shipping: new PrismaNamespace.Decimal(shipping),
          tax: new PrismaNamespace.Decimal(tax),
          total: new PrismaNamespace.Decimal(total),
          currency: DEFAULT_CURRENCY,
          notes: notes || null,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              productId: item.variant.productId,
              sku: item.variant.sku,
              name: item.variant.product.name,
              price: item.variant.price,
              quantity: item.quantity,
              attributesSnapshot: item.variant.attributes ?? undefined,
            })),
          },
          statusHistory: {
            create: {
              status: 'PENDING',
              note: 'Order placed — awaiting payment',
            },
          },
        },
      });

      for (const item of cart.items) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { reserved: { increment: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            change: 0,
            reason: 'order_reserve',
            referenceId: order.id,
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderDetailInclude,
      });
    });
  }

  /** Cancel a pending order and release reserved inventory */
  async cancelOrder(orderId: string, note = 'Order cancelled'): Promise<OrderDetail> {
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });

      if (order.status === 'CANCELLED') {
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetailInclude,
        });
      }

      for (const item of order.items) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { reserved: { decrement: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      await tx.orderStatusHistory.create({
        data: { orderId, status: 'CANCELLED', note },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderDetailInclude,
      });
    });
  }

  /** Advance or edit an order status from admin workflows */
  async updateStatus(orderId: string, status: OrderStatus, note?: string): Promise<OrderDetail> {
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });

      if (order.status === status) {
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetailInclude,
        });
      }

      if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
        for (const item of order.items) {
          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: { reserved: { decrement: item.quantity } },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: note ?? `Order marked ${status.toLowerCase()}`,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderDetailInclude,
      });
    });
  }

  private calculateSubtotal(cart: CartWithItems): number {
    return cart.items.reduce((total, item) => {
      const price =
        typeof item.variant.price === 'object' && 'toNumber' in item.variant.price
          ? item.variant.price.toNumber()
          : Number(item.variant.price);
      return total + price * item.quantity;
    }, 0);
  }

  private calculateShipping(subtotal: number): number {
    return subtotal >= FREE_SHIPPING_THRESHOLD_KES ? 0 : FLAT_SHIPPING_KES;
  }
}

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TV-${date}-${suffix}`;
}

export type { Order, OrderStatus };
