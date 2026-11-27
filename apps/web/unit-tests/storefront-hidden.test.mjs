import { describe, expect, it, vi } from 'vitest';

describe('cart availability', () => {
  it('flags a hidden or deleted product as unavailable', async () => {
    const { isCartItemAvailable } = await import('@/lib/cart-view');
    const make = (isActive, deletedAt) => ({ variant: { product: { isActive, deletedAt } } });
    expect(isCartItemAvailable(make(true, null))).toBe(true);
    expect(isCartItemAvailable(make(false, null))).toBe(false);
    expect(isCartItemAvailable(make(true, new Date()))).toBe(false);
  });
});

describe('sitemap', () => {
  it('asks only for active products and walks every page', async () => {
    vi.resetModules();
    const findMany = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ slug: 'a', updatedAt: new Date() }], totalPages: 2 })
      .mockResolvedValueOnce({ items: [{ slug: 'b', updatedAt: new Date() }], totalPages: 2 });
    vi.doMock('@repo/database', () => ({
      createRepositories: () => ({
        category: { findRootCategories: async () => [] },
        product: { findMany },
      }),
    }));
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();

    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [args] of findMany.mock.calls) expect(args.isActive).toBe(true);
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/products/a'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/products/b'))).toBe(true);
  });
});

describe('back-in-stock subscribe', () => {
  it('refuses a hidden product', async () => {
    vi.resetModules();
    const subscribe = vi.fn();
    vi.doMock('@repo/database', () => ({
      createRepositories: () => ({
        product: { findById: async () => ({ id: 'p1', isActive: false, deletedAt: null }) },
        backInStock: { subscribe },
      }),
    }));
    vi.doMock('@/auth', () => ({ auth: async () => null }));
    vi.doMock('@/lib/rate-limit', () => ({
      clientIdentifier: async () => '1.1.1.1',
      rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
      retryMessage: () => '',
    }));
    const mod = await import('@/lib/actions/back-in-stock');
    const fn = Object.values(mod).find((v) => typeof v === 'function');
    const form = new FormData();
    form.set('productId', 'p1');
    form.set('email', 'a@b.co');
    const res = await fn(null, form);
    expect(res.success).toBe(false);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
