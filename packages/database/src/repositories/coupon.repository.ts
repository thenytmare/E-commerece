import type { Prisma, Coupon } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface CreateCouponInput {
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrder?: number | null;
  maxUses?: number | null;
  /** Per-account cap, enforced during checkout. Null means unlimited. */
  maxUsesPerCustomer?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
}

export class CouponRepository extends BaseRepository {
  async findMany(options?: { isActive?: boolean; page?: number; limit?: number }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const where: Prisma.CouponWhereInput = {};
    if (options?.isActive !== undefined) where.isActive = options.isActive;
    
    const [items, total] = await Promise.all([
      this.db.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.db.coupon.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return this.db.coupon.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: new Date() } },
            ],
          },
        ],
      },
    });
  }

  async create(data: CreateCouponInput): Promise<Coupon> {
    return this.db.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        minOrder: data.minOrder ?? null,
        maxUses: data.maxUses ?? null,
        maxUsesPerCustomer: data.maxUsesPerCustomer ?? null,
        startsAt: data.startsAt ?? null,
        endsAt: data.endsAt ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: Partial<CreateCouponInput>): Promise<Coupon> {
    return this.db.coupon.update({
      where: { id },
      data: {
        ...(data.code !== undefined && { code: data.code.toUpperCase() }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.minOrder !== undefined && { minOrder: data.minOrder }),
        ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
        ...(data.maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: data.maxUsesPerCustomer }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  // NOTE: usage counting deliberately lives inside OrderRepository
  // .createFromCart's transaction rather than as a standalone method here.
  // The increment there is a conditional `updateMany` that re-checks
  // `usedCount < maxUses` in the same statement — being inside a
  // transaction is not enough on its own (Read Committed isolation lets two
  // concurrent checkouts both pass a plain read-then-write check). Don't
  // reintroduce a non-atomic incrementUsage() that reads usedCount in one
  // statement and writes it in another.

  async delete(id: string): Promise<Coupon> {
    return this.db.coupon.delete({ where: { id } });
  }
}