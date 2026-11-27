import { beforeEach, describe, expect, it, vi } from 'vitest';

const bulkSetActive = vi.fn();
const auditCreate = vi.fn();
const requirePermission = vi.fn();
const revalidateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock('@repo/database', () => ({
  prisma: {},
  createRepositories: () => ({
    product: { bulkSetActive },
    auditLog: { create: auditCreate },
  }),
}));
vi.mock('@/lib/actions/auth', () => ({ requirePermission }));
vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }));
vi.mock('@/lib/request-context', () => ({ getClientIp: async () => '127.0.0.1' }));
vi.mock('@repo/utils', () => ({ slugify: (s) => s, uniqueSlug: async (_f, s) => s }));
vi.mock('@/lib/validations/admin', () => ({ parseFormData: vi.fn(), productSchema: {} }));

const {
  setProductVisibilityAction,
  bulkSetProductVisibilityAction,
  toggleProductStatusAction,
  bulkActionProducts,
} = await import('@/lib/actions/admin-products');

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ user: { id: 'admin-1' } });
  bulkSetActive.mockResolvedValue(1);
  auditCreate.mockResolvedValue({});
});

describe('setProductVisibilityAction', () => {
  it('checks the products.write permission first', async () => {
    await setProductVisibilityAction('p1', false);
    expect(requirePermission).toHaveBeenCalledWith('products.write');
  });

  it('stops when the permission check redirects or throws, and writes nothing', async () => {
    requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(setProductVisibilityAction('p1', false)).rejects.toThrow('NEXT_REDIRECT');
    expect(bulkSetActive).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('hides a product, logs it, and refreshes cached storefront data', async () => {
    const res = await setProductVisibilityAction('p1', false);
    expect(res).toEqual({ success: true, changed: 1 });
    expect(bulkSetActive).toHaveBeenCalledWith(['p1'], false);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'product.visibility_change',
        entity: 'Product',
        entityId: 'p1',
        metadata: { ids: ['p1'], isActive: false, changed: 1 },
      })
    );
    expect(revalidateTag).toHaveBeenCalledWith('catalog');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/catalog/products');
  });

  it('reports a missing or trashed product and does not log or refresh', async () => {
    bulkSetActive.mockResolvedValue(0);
    const res = await setProductVisibilityAction('gone', true);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/missing or in the Trash/);
    expect(auditCreate).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects an empty id', async () => {
    const res = await setProductVisibilityAction('   ', true);
    expect(res.success).toBe(false);
    expect(bulkSetActive).not.toHaveBeenCalled();
  });

  it('returns a clear error when the database fails, without logging a change', async () => {
    bulkSetActive.mockRejectedValue(new Error('db down'));
    const res = await setProductVisibilityAction('p1', true);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Nothing was changed/);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('bulkSetProductVisibilityAction', () => {
  it('rejects more than 200 products and an empty list', async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => `p${i}`);
    expect((await bulkSetProductVisibilityAction(tooMany, false)).success).toBe(false);
    expect((await bulkSetProductVisibilityAction([], false)).success).toBe(false);
    expect(bulkSetActive).not.toHaveBeenCalled();
  });

  it('removes duplicate ids, writes one audit entry for the whole call', async () => {
    bulkSetActive.mockResolvedValue(2);
    const res = await bulkSetProductVisibilityAction(['a', 'b', 'a'], true);
    expect(res).toEqual({ success: true, changed: 2 });
    expect(bulkSetActive).toHaveBeenCalledWith(['a', 'b'], true);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].entityId).toBe('bulk');
  });
});

describe('older entry points use the same path', () => {
  it('toggleProductStatusAction delegates', async () => {
    await toggleProductStatusAction('p1', false);
    expect(bulkSetActive).toHaveBeenCalledWith(['p1'], false);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('bulkActionProducts activate and deactivate delegate and keep the audit log', async () => {
    bulkSetActive.mockResolvedValue(3);
    const res = await bulkActionProducts(['a', 'b', 'c'], 'deactivate');
    expect(res).toEqual({ success: true, count: 3 });
    expect(bulkSetActive).toHaveBeenCalledWith(['a', 'b', 'c'], false);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
