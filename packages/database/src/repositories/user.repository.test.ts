import { describe, expect, it, vi } from 'vitest';
import { UserRepository } from './user.repository';

describe('UserRepository restore', () => {
  it('restore clears the archive flag and switches the account back on', async () => {
    const db = { user: { update: vi.fn().mockResolvedValue({ id: 'u1' }) } };
    await new UserRepository(db as never).restore('u1');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { deletedAt: null, isActive: true },
    });
  });

  it('bulkRestore does the same for every id', async () => {
    const db = { user: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    const count = await new UserRepository(db as never).bulkRestore(['a', 'b']);
    expect(count).toBe(2);
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { deletedAt: null, isActive: true },
    });
  });
});
