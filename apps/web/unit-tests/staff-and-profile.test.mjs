import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

// ── Mocks ───────────────────────────────────────────────────────────────────
const user = {
  findById: vi.fn(),
  findByIdForAdmin: vi.fn(),
  findByEmailAnyCase: vi.fn(),
  updateProfile: vi.fn(),
  setStaffRole: vi.fn(),
};
const auditCreate = vi.fn();
const enqueueJob = vi.fn();
const tx = {
  role: { upsert: vi.fn() },
  user: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
};
const prisma = {
  $transaction: vi.fn(async (fn) => fn(tx)),
  verificationToken: { deleteMany: vi.fn() },
};
const requirePermission = vi.fn();
const requireAdmin = vi.fn();
const rateLimit = vi.fn();

vi.mock('@repo/database', () => ({
  prisma,
  enqueueJob,
  createRepositories: () => ({ user, auditLog: { create: auditCreate } }),
}));
vi.mock('@/lib/actions/auth', () => ({ requirePermission, requireAdmin }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/request-context', () => ({ getClientIp: async () => '127.0.0.1' }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit, retryMessage: (s) => `Try again in ${s} seconds.` }));
vi.mock('@/lib/mail', () => ({ isMailConfigured: () => true }));

const staff = await import('@/lib/actions/admin-staff');
const profile = await import('@/lib/actions/admin-profile');

function form(values) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const ME = { user: { id: 'admin-1', email: 'boss@shop.test' } };
let currentHash;

beforeEach(async () => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue(ME);
  requireAdmin.mockResolvedValue(ME);
  rateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  tx.role.upsert.mockResolvedValue({ id: 'role-x' });
  tx.user.create.mockResolvedValue({ id: 'new-user' });
  currentHash ??= await bcrypt.hash('old-password-123', 4);
  user.findById.mockResolvedValue({ id: 'admin-1', email: 'boss@shop.test', name: 'Boss', passwordHash: currentHash, roles: [] });
});

// ── Staff ───────────────────────────────────────────────────────────────────
describe('staff actions', () => {
  it('every staff action needs the admin-only staff.manage permission', async () => {
    requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(staff.addStaffAction(null, form({ email: 'a@b.co', name: '', role: 'MANAGER' }))).rejects.toThrow('NEXT_REDIRECT');
    await expect(staff.changeStaffRoleAction('u2', 'MANAGER')).rejects.toThrow('NEXT_REDIRECT');
    await expect(staff.removeStaffAction('u2')).rejects.toThrow('NEXT_REDIRECT');
    await expect(staff.resendInviteAction('u2')).rejects.toThrow('NEXT_REDIRECT');
    expect(requirePermission).toHaveBeenCalledWith('staff.manage');
    expect(user.setStaffRole).not.toHaveBeenCalled();
  });

  it('nobody can change or remove their own access', async () => {
    expect((await staff.changeStaffRoleAction('admin-1', 'SUPPORT')).success).toBe(false);
    expect((await staff.removeStaffAction('admin-1')).success).toBe(false);
    user.findByEmailAnyCase.mockResolvedValue({ id: 'admin-1', email: 'boss@shop.test', roles: [] });
    const res = await staff.addStaffAction(null, form({ email: 'BOSS@shop.test', name: '', role: 'SUPPORT' }));
    expect(res.fieldErrors.email).toMatch(/your own account/);
    expect(user.setStaffRole).not.toHaveBeenCalled();
  });

  it('refuses a role that does not exist', async () => {
    expect((await staff.changeStaffRoleAction('u2', 'CUSTOMER')).success).toBe(false);
    const res = await staff.addStaffAction(null, form({ email: 'a@b.co', name: '', role: 'OWNER' }));
    expect(res.fieldErrors.role).toBeTruthy();
    expect(user.setStaffRole).not.toHaveBeenCalled();
  });

  it('gives an existing customer a role, keeps their password, and logs it', async () => {
    user.findByEmailAnyCase.mockResolvedValue({ id: 'u2', email: 'ann@shop.test', passwordHash: 'h', roles: [{ role: { name: 'CUSTOMER' } }] });
    user.setStaffRole.mockResolvedValue('ok');
    const res = await staff.addStaffAction(null, form({ email: 'Ann@Shop.test', name: '', role: 'MANAGER' }));
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/Shop manager/);
    expect(user.setStaffRole).toHaveBeenCalledWith('u2', 'MANAGER');
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'staff.role_change', entityId: 'u2', metadata: expect.objectContaining({ from: 'CUSTOMER', to: 'MANAGER' }) })
    );
  });

  it('invites a new person: account with no password, hashed token, email queued, all in one transaction', async () => {
    user.findByEmailAnyCase.mockResolvedValue(null);
    const res = await staff.addStaffAction(null, form({ email: 'New@Shop.test', name: 'New Person', role: 'SUPPORT' }));
    expect(res.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'new@shop.test', name: 'New Person', passwordHash: null }) })
    );
    const saved = tx.verificationToken.create.mock.calls[0][0].data;
    expect(saved.identifier).toBe('password-reset:new@shop.test');
    const job = enqueueJob.mock.calls[0][1];
    expect(job.type).toBe('auth.staff-invite-email');
    // The database keeps only the hash; the emailed link carries the real token.
    const linkToken = new URL(job.payload.setPasswordUrl).searchParams.get('token');
    expect(saved.token).not.toBe(linkToken);
    expect(saved.token).toMatch(/^[0-9a-f]{64}$/);
    // About 3 days.
    const days = (saved.expires.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.9);
    expect(days).toBeLessThan(3.1);
    expect(job.payload.roleLabel).toBe('Support staff');
  });

  it('explains the last-admin rule in plain words', async () => {
    user.findById.mockResolvedValue({ id: 'u2', email: 'two@shop.test', roles: [{ role: { name: 'ADMIN' } }] });
    user.setStaffRole.mockResolvedValue('last_admin');
    const res = await staff.changeStaffRoleAction('u2', 'SUPPORT');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/at least one admin/);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('asks to try again when two admins change staff at once', async () => {
    user.findById.mockResolvedValue({ id: 'u2', email: 'two@shop.test', roles: [] });
    user.setStaffRole.mockRejectedValue(Object.assign(new Error('conflict'), { code: 'P2034' }));
    const res = await staff.changeStaffRoleAction('u2', 'SUPPORT');
    expect(res).toEqual({ success: false, message: expect.stringMatching(/Try again/) });
  });

  it('cancelling an unused invite deletes the account; removing a real staff member keeps it as a customer', async () => {
    user.findByIdForAdmin.mockResolvedValue({ id: 'u3', email: 'inv@shop.test', passwordHash: null, orders: [], roles: [] });
    const cancelled = await staff.removeStaffAction('u3');
    expect(cancelled.message).toMatch(/cancelled/);
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u3' } });
    expect(user.setStaffRole).not.toHaveBeenCalled();

    vi.clearAllMocks();
    requirePermission.mockResolvedValue(ME);
    user.findByIdForAdmin.mockResolvedValue({ id: 'u4', email: 'old@shop.test', passwordHash: 'h', orders: [], roles: [{ role: { name: 'MANAGER' } }] });
    user.setStaffRole.mockResolvedValue('ok');
    const removed = await staff.removeStaffAction('u4');
    expect(removed.success).toBe(true);
    expect(user.setStaffRole).toHaveBeenCalledWith('u4', null);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it('will not resend an invite to someone who already chose a password', async () => {
    user.findById.mockResolvedValue({ id: 'u5', email: 'set@shop.test', passwordHash: 'h', isActive: true, deletedAt: null, roles: [{ role: { name: 'SUPPORT' } }] });
    const res = await staff.resendInviteAction('u5');
    expect(res.success).toBe(false);
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

// ── Profile ─────────────────────────────────────────────────────────────────
describe('profile actions', () => {
  it('changes only the name without asking for the password', async () => {
    const res = await profile.updateProfileAction(null, form({ name: 'New Name', email: 'boss@shop.test', currentPassword: '' }));
    expect(res.success).toBe(true);
    expect(user.updateProfile).toHaveBeenCalledWith('admin-1', { name: 'New Name', email: 'boss@shop.test' });
  });

  it('a change of letter case alone is not a new email', async () => {
    const res = await profile.updateProfileAction(null, form({ name: 'Boss', email: 'BOSS@shop.test', currentPassword: '' }));
    expect(res.message).toBe('Nothing to change.');
    expect(user.updateProfile).not.toHaveBeenCalled();
  });

  it('changing the email needs the right current password', async () => {
    let res = await profile.updateProfileAction(null, form({ name: 'Boss', email: 'me@gmail.com', currentPassword: '' }));
    expect(res.fieldErrors.currentPassword).toBeTruthy();
    res = await profile.updateProfileAction(null, form({ name: 'Boss', email: 'me@gmail.com', currentPassword: 'wrong-password' }));
    expect(res.fieldErrors.currentPassword).toMatch(/not your current password/);
    expect(user.updateProfile).not.toHaveBeenCalled();
  });

  it('refuses an email another account uses, whatever the case', async () => {
    user.findByEmailAnyCase.mockResolvedValue({ id: 'someone-else' });
    const res = await profile.updateProfileAction(null, form({ name: 'Boss', email: 'Taken@Gmail.com', currentPassword: 'old-password-123' }));
    expect(res.fieldErrors.email).toMatch(/Another account/);
    expect(user.updateProfile).not.toHaveBeenCalled();
  });

  it('saves a new email, cancels old reset links, and logs both addresses', async () => {
    user.findByEmailAnyCase.mockResolvedValue(null);
    const res = await profile.updateProfileAction(null, form({ name: 'Boss', email: 'Me@Gmail.com', currentPassword: 'old-password-123' }));
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/me@gmail.com/);
    expect(user.updateProfile).toHaveBeenCalledWith('admin-1', { name: 'Boss', email: 'me@gmail.com' });
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.update', metadata: expect.objectContaining({ emailFrom: 'boss@shop.test', emailTo: 'me@gmail.com' }) })
    );
  });

  it('password guessing is limited', async () => {
    rateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 600 });
    const res = await profile.changePasswordAction(null, form({ currentPassword: 'x', newPassword: 'a-long-new-password', confirmPassword: 'a-long-new-password' }));
    expect(res.error).toMatch(/Try again/);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('checks the new password before saving it', async () => {
    let res = await profile.changePasswordAction(null, form({ currentPassword: 'old-password-123', newPassword: 'short', confirmPassword: 'short' }));
    expect(res.fieldErrors.newPassword).toMatch(/10 characters/);
    res = await profile.changePasswordAction(null, form({ currentPassword: 'old-password-123', newPassword: 'a-long-new-password', confirmPassword: 'different-one-here' }));
    expect(res.fieldErrors.confirmPassword).toBeTruthy();
    res = await profile.changePasswordAction(null, form({ currentPassword: 'wrong-password', newPassword: 'a-long-new-password', confirmPassword: 'a-long-new-password' }));
    expect(res.fieldErrors.currentPassword).toBeTruthy();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('changes the password to a new bcrypt hash and logs it', async () => {
    const res = await profile.changePasswordAction(null, form({ currentPassword: 'old-password-123', newPassword: 'a-long-new-password', confirmPassword: 'a-long-new-password' }));
    expect(res.success).toBe(true);
    const saved = tx.user.update.mock.calls[0][0];
    expect(saved.where).toEqual({ id: 'admin-1' });
    expect(await bcrypt.compare('a-long-new-password', saved.data.passwordHash)).toBe(true);
    expect(tx.verificationToken.deleteMany).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'profile.password_change', entityId: 'admin-1' }));
  });

  it('only ever changes the signed-in account', async () => {
    await profile.updateProfileAction(null, form({ name: 'X', email: 'boss@shop.test', currentPassword: '', id: 'victim' }));
    expect(user.updateProfile.mock.calls[0][0]).toBe('admin-1');
  });
});
