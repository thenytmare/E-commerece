import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE,
  FLAT_SHIPPING_KES,
  FREE_SHIPPING_THRESHOLD_KES,
  // Transition rules are shared with the admin UI so the buttons drawn there
  // and the rules enforced here can't drift apart.
  canTransitionOrderStatus,
} from '@repo/config';
import { randomBytes } from 'crypto';
import type { Order, OrderStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { BaseRepository } from './base.repository';
import type { CartWithItems } from './cart.repository';

const orderDetailInclude = {
  user: { select: { name: true, email: true } },
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
  shipment: true,
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

function transitionError(from: OrderStatus, to: OrderStatus): Error {
  return new Error(
    `An order that is ${from.toLowerCase()} can't be marked ${to.toLowerCase()}.`
  );
}

export interface CreateOrderInput {
  cart: CartWithItems;
  /** Null for a guest checkout. */
  userId: string | null;
  addressId: string;
  notes?: string;
  couponCode?: string;
  /** Contact address for a guest order, where there's no account to read one from. */
  guestEmail?: string;
}

/**
 * Data access for orders and checkout.
 */
export class OrderRepository extends BaseRepository {
  /** Find an order by its internal id */
  findById(id: string): Promise<OrderDetail | null> {
    return this.db.order.findUnique({
      where: { id },
      include: orderDetailInclude,
    });
  }

  /** Find an order by its public order number */
  findByOrderNumber(orderNumber: string): Promise<OrderDetail | null> {
    return this.db.order.findUnique({
      where: { orderNumber },
      include: orderDetailInclude,
    });
  }

  /** Find an order by id, scoped to its owner */
  findByIdForUser(orderId: string, userId: string): Promise<OrderDetail | null> {
    return this.db.order.findFirst({
      where: { id: orderId, userId },
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

  /**
   * Paginated, searchable order list for the admin table.
   *
   * Replaces listAll(50) there: with a hard 50-row cap and filtering done in
   * the browser, any order past the fiftieth was invisible and unsearchable —
   * support simply could not find it. Searching covers the order number plus
   * both the shipping recipient and the account holder, since those differ on
   * gift orders.
   */
  async adminFindMany(options?: {
    search?: string;
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    items: OrderDetail[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(Math.max(1, options?.limit ?? 25), 100);

    const where: Prisma.OrderWhereInput = {};
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.search) {
      const search = options.search;
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { address: { name: { contains: search, mode: 'insensitive' } } },
        { address: { phone: { contains: search } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.order.findMany({
        where,
        include: orderDetailInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.order.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /**
   * Order dataset for dashboard aggregation — deliberately narrow (no
   * user/address/statusHistory) so scanning every order stays cheap, plus
   * nested payments/items on every row.
   *
   * Capped at `limit` (most recent first) rather than truly unbounded: this
   * used to have no cap at all, which meant every admin dashboard load
   * scanned the entire orders table (with nested payments/items) regardless
   * of how large it had grown. Past a few thousand orders that's a lot of
   * rows to pull into JS just to sum and group them in
   * apps/web/lib/actions/admin-dashboard.ts.
   *
   * This is a defensive limit, not a real fix — callers there only need
   * aggregates (totals, monthly trend, top products, revenue by category),
   * which belong in the database via Prisma's groupBy/aggregate (or a
   * periodically-refreshed rollup table) instead of being computed in JS
   * over every row on every load. Doing that properly is a larger change
   * than this hardening pass; once the store has more orders than `limit`,
   * results here silently become "most recent N" rather than all-time, which
   * is an acceptable interim trade-off but not a permanent one.
   */
  listAllForAnalytics(limit = 5000) {
    return this.db.order.findMany({
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
        payments: { select: { status: true, amount: true } },
        items: { select: { productId: true, price: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Create an order from a cart, reserve stock, and clear the cart */
  async createFromCart(input: CreateOrderInput): Promise<OrderDetail> {
    const { cart, userId, addressId, notes, couponCode, guestEmail } = input;

    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // A signed-in customer may only ship to one of their own addresses. A
    // guest's address is unowned, so it must not already belong to an account
    // — otherwise an order number plus an address id would be enough to ship
    // to someone else's saved address.
    const address = await this.db.address.findFirst({
      where: userId ? { id: addressId, userId } : { id: addressId, userId: null },
    });
    if (!address) {
      throw new Error('Invalid shipping address');
    }

    return this.db.$transaction(async (tx) => {
      // Resolve what each line actually costs, taking any running flash sale
      // into account. Previously the sale price was only ever read on the
      // product page, so a customer saw the discount, added to cart, and was
      // then charged full price at checkout.
      const unitPrices = await this.resolveUnitPrices(tx, cart);
      const subtotal = cart.items.reduce(
        (total, item) => total + unitPrices.get(item.variantId)! * item.quantity,
        0
      );
      const shipping = this.calculateShipping(subtotal);
      // Named constant rather than a bare 0: Kenyan VAT isn't charged yet,
      // which is a pending business decision, not something left out by
      // accident. See its definition in packages/config for the full reason.
      const tax = DEFAULT_TAX_RATE;

      // Reserve atomically: the availability test and the increment are one
      // statement, so two concurrent checkouts for the last unit can't both
      // pass the check before either commits. Prisma can't compare two columns
      // in a `where`, hence raw SQL. A zero row count means "not enough stock".
      for (const item of cart.items) {
        const reserved = await tx.$executeRaw`
          UPDATE "inventory"
          SET "reserved" = "reserved" + ${item.quantity}
          WHERE "variant_id" = ${item.variantId}
            AND "quantity" - "reserved" >= ${item.quantity}
        `;

        if (reserved === 0) {
          throw new Error(`Insufficient stock for ${item.variant.product.name}`);
        }
      }

      // Coupon validation, discount calculation, and usage-count increment
      // all happen inside this transaction so a coupon can never be applied
      // past its expiry/usage limit under concurrent checkouts.
      //
      // `discount` is a Prisma Decimal (decimal.js) from here on, computed
      // with its own .times()/.dividedBy()/etc rather than converted to a
      // JS number and back — coupon.value already arrives as a Decimal from
      // the query above, so this avoids a number round-trip for the one
      // money calculation in this file with an actual multiplication/division
      // in it (percentage coupons), which is where float error could compound.
      let discount = new PrismaNamespace.Decimal(0);
      let couponId: string | null = null;
      if (couponCode) {
        const coupon = await tx.coupon.findFirst({
          where: {
            code: { equals: couponCode, mode: 'insensitive' },
            isActive: true,
            OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
          },
        });
        if (!coupon) {
          throw new Error('This coupon code is invalid or has expired');
        }
        // Both Number(coupon.minOrder) calls below only feed a magnitude
        // comparison and an error message — the result is never stored or
        // fed back into the order total, so float imprecision (if any, for a
        // plain comparison/display of a 2-decimal-place amount) can't
        // corrupt money that gets written to the database.
        if (coupon.minOrder !== null && subtotal < Number(coupon.minOrder)) {
          throw new Error(
            `This coupon requires a minimum order of ${DEFAULT_CURRENCY} ${Number(coupon.minOrder).toLocaleString()}`
          );
        }
        if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
          throw new Error('This coupon has reached its usage limit');
        }

        // Per-customer cap. Counted inside the transaction so concurrent
        // checkouts by the same account can't both slip under the limit.
        // Cancelled orders don't count against it — the customer never got
        // the benefit. Guests have no account to count against, so the global
        // maxUses is the only limit that can apply to them.
        //
        // Unlike the global `usedCount` cap below, there's no counter column
        // to increment with a single atomic conditional update — the count
        // here is derived by counting matching `Order` rows, and Postgres has
        // no way to make "count rows, then conditionally insert a new one"
        // atomic in one statement without something to hang a constraint on.
        // A fully atomic version would need a schema change (e.g. a
        // `CouponRedemption(couponId, userId)` row per use, or a per-customer
        // counter table incremented the same way `usedCount` is) — worth
        // doing, but a bigger change than this file should carry on its own.
        //
        // In the meantime, this closes the actual race (not just narrows it)
        // without a schema change: a Postgres transaction-scoped advisory
        // lock, keyed on a hash of (couponId, userId), serializes concurrent
        // checkouts for that exact pair. A second transaction racing the
        // first blocks here until the first commits or rolls back, so by the
        // time it reaches the count below, it's guaranteed to see every order
        // the first one placed. The lock is released automatically when this
        // transaction ends either way. This only matters for one account
        // racing itself (a coupon+userId pair is unique to one customer), so
        // there's no contention between different customers to worry about.
        if (coupon.maxUsesPerCustomer !== null && userId) {
          // $queryRaw, not $executeRaw: this is a SELECT (it returns a row),
          // even though the value in it is discarded — we're here only for
          // the blocking side effect of acquiring the lock.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${coupon.id}), hashtext(${userId}))`;

          const timesUsed = await tx.order.count({
            where: {
              couponId: coupon.id,
              userId,
              status: { notIn: ['CANCELLED'] },
            },
          });
          if (timesUsed >= coupon.maxUsesPerCustomer) {
            throw new Error('You have already used this coupon the maximum number of times');
          }
        }

        // Clamped to the subtotal in both branches. A percentage coupon
        // configured above 100 would otherwise produce a negative total, which
        // both payment providers reject — leaving an order that exists, holds
        // stock, and can never be paid.
        //
        // `subtotal` itself stays a plain number (see resolveUnitPrices) —
        // only this calculation, the one with an actual multiplication/
        // division, is worth doing in Decimal — but Decimal's arithmetic
        // methods accept a plain number directly, so no conversion is needed
        // to combine the two. `.toDecimalPlaces(0)` rounds the same way
        // `Math.round` did for these always-non-negative values.
        const subtotalDecimal = new PrismaNamespace.Decimal(subtotal);
        const rawDiscount =
          coupon.type === 'PERCENTAGE'
            ? subtotalDecimal.times(coupon.value).dividedBy(100).toDecimalPlaces(0)
            : coupon.value;
        discount = PrismaNamespace.Decimal.min(
          PrismaNamespace.Decimal.max(rawDiscount, 0),
          subtotalDecimal
        );
        couponId = coupon.id;

        // Atomic conditional increment — mirrors the stock-reservation update
        // above. Re-checking `usedCount < maxUses` in the same statement that
        // increments it is what makes this safe under concurrent checkouts;
        // the earlier read-then-write (read here, `update` after) was not,
        // since Postgres's default Read Committed isolation lets two
        // transactions both pass the read before either commits the write.
        const redeemed = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            OR: [{ maxUses: null }, { usedCount: { lt: coupon.maxUses ?? undefined } }],
          },
          data: { usedCount: { increment: 1 } },
        });

        if (redeemed.count === 0) {
          throw new Error('This coupon has reached its usage limit');
        }
      }

      // Decimal arithmetic here too, for the same reason as `discount` above
      // — this is the other place the final, stored money value is actually
      // combined from several terms rather than just passed through.
      const total = PrismaNamespace.Decimal.max(
        0,
        new PrismaNamespace.Decimal(subtotal).plus(shipping).plus(tax).minus(discount)
      );
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          guestEmail: userId ? null : (guestEmail ?? null),
          addressId,
          couponId,
          status: 'PENDING',
          subtotal: new PrismaNamespace.Decimal(subtotal),
          // Already Decimal instances — see above.
          discount,
          shipping: new PrismaNamespace.Decimal(shipping),
          tax: new PrismaNamespace.Decimal(tax),
          total,
          currency: DEFAULT_CURRENCY,
          notes: notes || null,
          items: {
            create: cart.items.map((item) => ({
              variantId: item.variantId,
              productId: item.variant.productId,
              sku: item.variant.sku,
              name: item.variant.product.name,
              // The price actually charged, not the variant's list price.
              price: new PrismaNamespace.Decimal(unitPrices.get(item.variantId)!),
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

      // Stock was already reserved atomically above; this only records why.
      for (const item of cart.items) {
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
    }, {
      // Prisma's defaults (2s to acquire a connection, 5s transaction budget)
      // are too tight here: this transaction does a per-cart-item stock
      // reservation loop plus order/item creation, and can legitimately run
      // long under concurrent checkout load or connection-pool pressure —
      // an e2e run against this exact path measured 7-7.5s. A slower
      // checkout is fine; a checkout that fails with "transaction already
      // closed" is not.
      maxWait: 10_000,
      timeout: 15_000,
    });
  }

  /**
   * Orders still PENDING past a cut-off with no completed payment.
   *
   * These are holding reserved stock for a checkout that was never finished,
   * so they're the input to the cleanup job that releases it.
   */
  findAbandoned(olderThan: Date): Promise<{ id: string; orderNumber: string }[]> {
    return this.db.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: olderThan },
        payments: { none: { status: 'COMPLETED' } },
      },
      select: { id: true, orderNumber: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Cancel an order that hasn't shipped yet and release its reserved stock.
   *
   * If the order was already paid, the completed payment is flagged REFUNDED
   * in the same transaction. Without that, cancelling a paid order left the
   * payment COMPLETED forever with nothing anywhere recording that money was
   * owed back to the customer.
   */
  async cancelOrder(
    orderId: string,
    note = 'Order cancelled',
    actorId?: string
  ): Promise<OrderDetail> {
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

      if (!canTransitionOrderStatus(order.status, 'CANCELLED')) {
        throw new Error(
          `An order that is ${order.status.toLowerCase()} can no longer be cancelled. Refund it instead.`
        );
      }

      // Safe unconditionally: CANCELLED is only reachable from a
      // pre-fulfilment status, so these units never left the warehouse.
      for (const item of order.items) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { reserved: { decrement: item.quantity } },
        });
      }

      const refunded = await tx.payment.updateMany({
        where: { orderId, status: 'COMPLETED' },
        data: { status: 'REFUNDED' },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: 'CANCELLED',
          note:
            refunded.count > 0
              ? `${note} — payment marked refunded, process the refund with the provider.`
              : note,
          createdBy: actorId ?? null,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderDetailInclude,
      });
    }, {
      // Same per-item-loop shape as createFromCart's transaction — see the
      // comment there. Prisma's 5s default is too tight for an order with
      // several line items under any real contention.
      maxWait: 10_000,
      timeout: 15_000,
    });
  }

  /** Advance an order status from admin workflows, enforcing valid transitions */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    note?: string,
    actorId?: string
  ): Promise<OrderDetail> {
    if (status === 'CANCELLED') {
      return this.cancelOrder(orderId, note ?? 'Order cancelled', actorId);
    }
    if (status === 'REFUNDED') {
      return this.refundOrder(orderId, note ?? 'Order refunded', actorId);
    }

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

      if (!canTransitionOrderStatus(order.status, status)) {
        throw transitionError(order.status, status);
      }

      // Dispatch is the point stock physically leaves. Until this existed,
      // `quantity` was never decremented by a sale at all — `reserved` was
      // silently doing double duty as both "held for a pending order" and
      // "gone because it shipped", which is what made cancelling a delivered
      // order put sold units back on the shelf.
      //
      // SHIPPED is reachable exactly once (only from CONFIRMED/PROCESSING, and
      // never again once past it), so this can't double-apply.
      if (status === 'SHIPPED') {
        for (const item of order.items) {
          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: {
              quantity: { decrement: item.quantity },
              reserved: { decrement: item.quantity },
            },
          });
          await tx.inventoryLog.create({
            data: {
              variantId: item.variantId,
              change: -item.quantity,
              reason: 'order_shipped',
              referenceId: orderId,
            },
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
          createdBy: actorId ?? null,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderDetailInclude,
      });
    });
  }

  /**
   * Refund a shipped or delivered order and flag its payment to match.
   *
   * Stock is deliberately not returned here: a refund after dispatch means a
   * return is in progress, and whether those units are resaleable is a
   * judgement call for whoever inspects them. Restock explicitly from the
   * inventory screen once they're back on the shelf.
   */
  async refundOrder(
    orderId: string,
    note = 'Order refunded',
    actorId?: string
  ): Promise<OrderDetail> {
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

      if (order.status === 'REFUNDED') {
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetailInclude,
        });
      }

      if (!canTransitionOrderStatus(order.status, 'REFUNDED')) {
        throw transitionError(order.status, 'REFUNDED');
      }

      await tx.payment.updateMany({
        where: { orderId, status: 'COMPLETED' },
        data: { status: 'REFUNDED' },
      });

      await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });

      await tx.orderStatusHistory.create({
        data: { orderId, status: 'REFUNDED', note, createdBy: actorId ?? null },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderDetailInclude,
      });
    });
  }

  /**
   * Unit price per variant for this cart, with any active flash sale applied.
   *
   * Runs inside the checkout transaction so the price charged is resolved from
   * the same snapshot as the stock reservation — a sale expiring mid-checkout
   * can't produce an order priced against a sale that is no longer running.
   */
  private async resolveUnitPrices(
    tx: Prisma.TransactionClient,
    cart: CartWithItems
  ): Promise<Map<string, number>> {
    const productIds = [...new Set(cart.items.map((item) => item.variant.productId))];
    const now = new Date();

    const activeSales = await tx.flashSale.findMany({
      where: {
        productId: { in: productIds },
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { salePrice: 'asc' },
    });

    // Cheapest active sale wins where several overlap, matching what the
    // product page displays.
    //
    // These Number() conversions (and listPrice below) stay plain-number
    // rather than Decimal: each is used only in a Math.min() comparison
    // here, not multiplied or divided, so there's no arithmetic for float
    // error to compound in — the result goes straight into `unitPrices`
    // unchanged and is re-wrapped as a Decimal at the point it's written
    // (both as an order item's `price` and, via the `subtotal` sum in
    // createFromCart, into the total/discount Decimal math above).
    const salePriceByProduct = new Map<string, number>();
    for (const sale of activeSales) {
      if (!salePriceByProduct.has(sale.productId)) {
        salePriceByProduct.set(sale.productId, Number(sale.salePrice));
      }
    }

    const unitPrices = new Map<string, number>();
    for (const item of cart.items) {
      const listPrice = Number(item.variant.price);
      const salePrice = salePriceByProduct.get(item.variant.productId);
      // A "sale" priced above list never raises the price.
      unitPrices.set(
        item.variantId,
        salePrice === undefined ? listPrice : Math.min(listPrice, salePrice)
      );
    }

    return unitPrices;
  }

  private calculateShipping(subtotal: number): number {
    return subtotal >= FREE_SHIPPING_THRESHOLD_KES ? 0 : FLAT_SHIPPING_KES;
  }
}

// Excludes I, L, O, 0 and 1 so an order number read off a receipt over the
// phone can't be transcribed ambiguously.
const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // Crypto-random rather than Math.random: the order number is a public URL
  // segment and the lookup key for a customer's own order page.
  const bytes = randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += ORDER_NUMBER_ALPHABET[bytes[i]! % ORDER_NUMBER_ALPHABET.length];
  }
  return `TV-${date}-${suffix}`;
}

export type { Order, OrderStatus };
