import { describe, expect, it, vi } from 'vitest';
import { CouponRepository } from './coupon.repository';

describe('CouponRepository', () => {
  const mockDb = {
    coupon: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const repo = new CouponRepository(mockDb as never);

  it('findByCode looks up an active, in-window coupon case-insensitively', async () => {
    mockDb.coupon.findFirst.mockResolvedValue({ id: 'coupon-1', code: 'SAVE10' });

    const coupon = await repo.findByCode('save10');

    expect(coupon?.id).toBe('coupon-1');
    const where = mockDb.coupon.findFirst.mock.calls[0]![0].where;
    expect(where.code).toEqual({ equals: 'save10', mode: 'insensitive' });
    expect(where.isActive).toBe(true);
    // Both the "hasn't started yet" and "already ended" cases must be
    // excluded — the coupon is valid whether startsAt/endsAt are unset or
    // straddle now.
    expect(where.OR).toEqual([{ startsAt: null }, { startsAt: { lte: expect.any(Date) } }]);
    expect(where.AND).toEqual([
      { OR: [{ endsAt: null }, { endsAt: { gte: expect.any(Date) } }] },
    ]);
  });

  it('findByCode returns null when no coupon matches', async () => {
    mockDb.coupon.findFirst.mockResolvedValue(null);

    await expect(repo.findByCode('MISSING')).resolves.toBeNull();
  });

  it('findMany filters by isActive and paginates with defaults', async () => {
    mockDb.coupon.findMany.mockResolvedValue([{ id: 'coupon-1' }]);
    mockDb.coupon.count.mockResolvedValue(1);

    const result = await repo.findMany({ isActive: true });

    expect(mockDb.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, skip: 0, take: 20 })
    );
    expect(result).toEqual({
      items: [{ id: 'coupon-1' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('findMany omits the isActive filter when not specified', async () => {
    mockDb.coupon.findMany.mockResolvedValue([]);
    mockDb.coupon.count.mockResolvedValue(0);

    await repo.findMany();

    expect(mockDb.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('create normalizes the code to uppercase and defaults optional fields', async () => {
    mockDb.coupon.create.mockResolvedValue({ id: 'coupon-1', code: 'WELCOME' });

    await repo.create({ code: 'welcome', type: 'FIXED', value: 500 });

    expect(mockDb.coupon.create).toHaveBeenCalledWith({
      data: {
        code: 'WELCOME',
        type: 'FIXED',
        value: 500,
        minOrder: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        startsAt: null,
        endsAt: null,
        isActive: true,
      },
    });
  });

  it('create honors an explicit per-customer cap and inactive flag', async () => {
    mockDb.coupon.create.mockResolvedValue({ id: 'coupon-2' });

    await repo.create({
      code: 'LIMITED',
      type: 'PERCENTAGE',
      value: 15,
      maxUsesPerCustomer: 1,
      isActive: false,
    });

    expect(mockDb.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxUsesPerCustomer: 1, isActive: false }),
      })
    );
  });

  it('update only touches the fields that were provided', async () => {
    mockDb.coupon.update.mockResolvedValue({ id: 'coupon-1', isActive: false });

    await repo.update('coupon-1', { isActive: false });

    expect(mockDb.coupon.update).toHaveBeenCalledWith({
      where: { id: 'coupon-1' },
      data: { isActive: false },
    });
  });

  it('update uppercases a replacement code', async () => {
    mockDb.coupon.update.mockResolvedValue({ id: 'coupon-1', code: 'NEWCODE' });

    await repo.update('coupon-1', { code: 'newcode' });

    expect(mockDb.coupon.update).toHaveBeenCalledWith({
      where: { id: 'coupon-1' },
      data: { code: 'NEWCODE' },
    });
  });

  it('delete removes a coupon by id', async () => {
    mockDb.coupon.delete.mockResolvedValue({ id: 'coupon-1' });

    await repo.delete('coupon-1');

    expect(mockDb.coupon.delete).toHaveBeenCalledWith({ where: { id: 'coupon-1' } });
  });
});
