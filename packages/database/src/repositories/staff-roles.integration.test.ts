/**
 * Staff roles against a real Postgres. Skipped unless DB_INTEGRATION=1.
 * Run with a throwaway database that has no other admins in it:
 *   DB_INTEGRATION=1 pnpm --filter @repo/database test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RoleName } from '@prisma/client';
import { prisma } from '../client';
import { UserRepository } from './user.repository';

const run = process.env.DB_INTEGRATION === '1';
const tag = `staff-itest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const users = new UserRepository(prisma);

async function makeUser(name: string, roles: RoleName[], opts: { password?: boolean; active?: boolean } = {}) {
  return prisma.user.create({
    data: {
      email: `${tag}-${name}@example.com`,
      passwordHash: opts.password === false ? null : 'hash',
      isActive: opts.active ?? true,
      roles: { create: roles.map((role) => ({ role: { connect: { name: role } } })) },
    },
  });
}

async function rolesOf(id: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({ where: { userId: id }, include: { role: true } });
  return rows.map((row) => row.role.name).sort();
}

/** Admins outside this test would hide the last-admin rule, so those cases need a clean database. */
async function otherAdmins(): Promise<number> {
  return prisma.user.count({
    where: {
      email: { not: { startsWith: tag } },
      isActive: true,
      deletedAt: null,
      passwordHash: { not: null },
      roles: { some: { role: { name: 'ADMIN' } } },
    },
  });
}

beforeAll(async () => {
  if (!run) return;
  for (const name of ['ADMIN', 'MANAGER', 'SUPPORT', 'CUSTOMER'] as const) {
    await prisma.role.upsert({ where: { name }, create: { name }, update: {} });
  }
});

afterAll(async () => {
  if (!run) return;
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe.skipIf(!run)('staff roles (real database)', () => {
  it('keeps customers and staff apart in the admin lists', async () => {
    const customer = await makeUser('list-customer', ['CUSTOMER']);
    const manager = await makeUser('list-manager', ['MANAGER']);

    const customers = await users.adminFindMany({ audience: 'customers', search: tag, limit: 100 });
    const staff = await users.adminFindMany({ audience: 'staff', search: tag, limit: 100 });

    expect(customers.items.map((u) => u.id)).toContain(customer.id);
    expect(customers.items.map((u) => u.id)).not.toContain(manager.id);
    expect(staff.items.map((u) => u.id)).toContain(manager.id);
    expect(staff.items.map((u) => u.id)).not.toContain(customer.id);
    expect(await users.staffIdsAmong([customer.id, manager.id])).toEqual([manager.id]);
  });

  it('gives exactly one staff role, keeps the customer role, and removes access cleanly', async () => {
    const person = await makeUser('promote', ['CUSTOMER']);

    expect(await users.setStaffRole(person.id, 'SUPPORT')).toBe('ok');
    expect(await rolesOf(person.id)).toEqual(['CUSTOMER', 'SUPPORT']);

    expect(await users.setStaffRole(person.id, 'SUPPORT')).toBe('unchanged');

    expect(await users.setStaffRole(person.id, 'MANAGER')).toBe('ok');
    expect(await rolesOf(person.id)).toEqual(['CUSTOMER', 'MANAGER']);

    expect(await users.setStaffRole(person.id, null)).toBe('ok');
    expect(await rolesOf(person.id)).toEqual(['CUSTOMER']);
    expect(await users.setStaffRole(person.id, null)).toBe('unchanged');
  });

  it('a former staff member with no customer role still ends up a customer', async () => {
    const person = await makeUser('support-only', ['SUPPORT']);
    expect(await users.setStaffRole(person.id, null)).toBe('ok');
    expect(await rolesOf(person.id)).toEqual(['CUSTOMER']);
  });

  it('refuses switched-off and missing accounts', async () => {
    const off = await makeUser('off', ['CUSTOMER'], { active: false });
    expect(await users.setStaffRole(off.id, 'MANAGER')).toBe('unavailable');
    expect(await users.setStaffRole('no-such-user', 'MANAGER')).toBe('not_found');
  });

  it('never removes the last admin who can sign in, and undoes the attempt', async (ctx) => {
    if ((await otherAdmins()) > 0) ctx.skip();
    const admin = await makeUser('sole-admin', ['ADMIN']);
    // An invited admin who has not chosen a password cannot sign in, so does not count.
    await makeUser('invited-admin', ['ADMIN'], { password: false });

    expect(await users.setStaffRole(admin.id, 'MANAGER')).toBe('last_admin');
    expect(await users.setStaffRole(admin.id, null)).toBe('last_admin');
    expect(await rolesOf(admin.id)).toEqual(['ADMIN']);

    await prisma.user.deleteMany({ where: { email: { startsWith: `${tag}-sole-admin` } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${tag}-invited-admin` } } });
  });

  it('two admins demoting each other at the same moment cannot both succeed', async (ctx) => {
    if ((await otherAdmins()) > 0) ctx.skip();
    const a = await makeUser('race-a', ['ADMIN']);
    const b = await makeUser('race-b', ['ADMIN']);

    const outcomes = await Promise.allSettled([users.setStaffRole(a.id, 'MANAGER'), users.setStaffRole(b.id, 'MANAGER')]);
    const ok = outcomes.filter((o) => o.status === 'fulfilled' && o.value === 'ok').length;

    expect(ok).toBeLessThanOrEqual(1);
    const admins = await prisma.user.count({
      where: { id: { in: [a.id, b.id] }, roles: { some: { role: { name: 'ADMIN' } } } },
    });
    expect(admins).toBeGreaterThanOrEqual(1);
  });

  it('finds an account whatever the letter case', async () => {
    const person = await makeUser('Case', ['CUSTOMER']);
    const found = await users.findByEmailAnyCase(person.email.toUpperCase());
    expect(found?.id).toBe(person.id);
  });
});
