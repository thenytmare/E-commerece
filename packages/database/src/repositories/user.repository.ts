import type { Prisma, User, RoleName } from '@prisma/client';
import { BaseRepository } from './base.repository';

const userWithRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRoles }>;

const adminUserListInclude = {
  roles: { include: { role: true } },
  _count: { select: { orders: true, reviews: true, addresses: true } },
} satisfies Prisma.UserInclude;

export type AdminUserListItem = Prisma.UserGetPayload<{ include: typeof adminUserListInclude }>;

/** Roles that can open the admin. Anyone without one of these is a customer. */
export const STAFF_ROLES = ['ADMIN', 'MANAGER', 'SUPPORT'] as const satisfies readonly RoleName[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

const staffListSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  passwordHash: true,
  roles: { select: { role: { select: { name: true } } } },
} satisfies Prisma.UserSelect;

/** Contains the password hash. Map it to a yes/no before it leaves the server. */
export type StaffListRow = Prisma.UserGetPayload<{ select: typeof staffListSelect }>;

export type SetStaffRoleResult = 'ok' | 'unchanged' | 'not_found' | 'unavailable' | 'last_admin';

/** Thrown inside the role transaction so the whole change is undone. */
class LastAdminError extends Error {}

export class UserRepository extends BaseRepository {
  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({ where: { email }, include: userWithRoles });
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({ where: { id }, include: userWithRoles });
  }

  async findByIdForAdmin(id: string) {
    return this.db.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        addresses: { orderBy: { isDefault: 'desc' } },
        orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { payments: true } },
        wishlists: {
          take: 5,
          include: { product: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  }

  async adminFindMany(options?: {
    search?: string;
    isActive?: boolean;
    isDeleted?: boolean;
    role?: RoleName;
    /** "customers" leaves out anyone with a staff role; "staff" shows only them. */
    audience?: 'customers' | 'staff';
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminUserListItem[]; total: number }> {
    const where: Prisma.UserWhereInput = {};
    const and: Prisma.UserWhereInput[] = [];

    if (options?.audience === 'customers') {
      and.push({ roles: { none: { role: { name: { in: [...STAFF_ROLES] } } } } });
    } else if (options?.audience === 'staff') {
      and.push({ roles: { some: { role: { name: { in: [...STAFF_ROLES] } } } } });
    }

    if (options?.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { name: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.isDeleted) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options?.role) {
      and.push({ roles: { some: { role: { name: options.role } } } });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: adminUserListInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.user.count({ where }),
    ]);

    return { items, total };
  }

  getStats() {
    return this.db.user.count({ where: { deletedAt: null } });
  }

  async getDetailedStats() {
    const [total, active, newThisMonth, customers, admins] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null } }),
      this.db.user.count({ where: { isActive: true, deletedAt: null } }),
      this.db.user.count({
        where: { deletedAt: null, createdAt: { gte: new Date(new Date().setDate(1)) } },
      }),
      this.db.user.count({
        where: { deletedAt: null, roles: { some: { role: { name: 'CUSTOMER' } } } },
      }),
      this.db.user.count({
        where: {
          deletedAt: null,
          roles: { some: { role: { name: { in: ['ADMIN', 'MANAGER', 'SUPPORT'] } } } },
        },
      }),
    ]);
    return { total, active, inactive: total - active, newThisMonth, customers, admins };
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.db.user.create({ data });
  }

  async createWithPassword(data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<UserWithRoles> {
    const user = await this.create({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
    });
    await this.assignRole(user.id, 'CUSTOMER');
    const withRoles = await this.findById(user.id);
    if (!withRoles) throw new Error('Failed to load user after creation');
    return withRoles;
  }

  async assignRole(userId: string, roleName: RoleName): Promise<void> {
    const role = await this.db.role.findUniqueOrThrow({ where: { name: roleName } });
    await this.db.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  /** Everyone who can open the admin, oldest first. Archived accounts are left out. */
  async findStaff(): Promise<StaffListRow[]> {
    return this.db.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: { in: [...STAFF_ROLES] } } } } },
      select: staffListSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Give a user exactly one staff role, or take staff access away (role null).
   * Taking it away leaves them as a customer.
   *
   * The shop must always keep at least one admin who can sign in. The check
   * runs inside the same serializable transaction as the change, so two admins
   * demoting each other at the same moment cannot both succeed.
   */
  async setStaffRole(userId: string, role: StaffRole | null): Promise<SetStaffRoleResult> {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: {
              isActive: true,
              deletedAt: true,
              roles: { select: { role: { select: { name: true } } } },
            },
          });
          if (!user) return 'not_found';
          if (!user.isActive || user.deletedAt) return 'unavailable';

          const current = user.roles.map((entry) => entry.role.name).filter(isStaffRole);
          const unchanged = role
            ? current.length === 1 && current[0] === role
            : current.length === 0;
          if (unchanged) return 'unchanged';

          const staffRoles = await tx.role.findMany({
            where: { name: { in: [...STAFF_ROLES] } },
            select: { id: true },
          });
          await tx.userRole.deleteMany({
            where: { userId, roleId: { in: staffRoles.map((r) => r.id) } },
          });

          const keep = await tx.role.upsert({
            where: { name: role ?? 'CUSTOMER' },
            create: { name: role ?? 'CUSTOMER' },
            update: {},
          });
          await tx.userRole.upsert({
            where: { userId_roleId: { userId, roleId: keep.id } },
            create: { userId, roleId: keep.id },
            update: {},
          });

          // Only a change that takes ADMIN away can leave the shop without one.
          if (current.includes('ADMIN') && role !== 'ADMIN') {
            const admins = await tx.user.count({
              where: {
                isActive: true,
                deletedAt: null,
                passwordHash: { not: null },
                roles: { some: { role: { name: 'ADMIN' } } },
              },
            });
            if (admins === 0) throw new LastAdminError();
          }
          return 'ok';
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (error) {
      if (error instanceof LastAdminError) return 'last_admin';
      throw error;
    }
  }

  /** Finds an account whatever the letter case, so "Ann@x.com" and "ann@x.com" count as the same. */
  async findByEmailAnyCase(email: string): Promise<UserWithRoles | null> {
    return this.db.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: userWithRoles,
    });
  }

  /** Which of these ids belong to staff. Used to keep customer actions off staff accounts. */
  async staffIdsAmong(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.user.findMany({
      where: { id: { in: ids }, roles: { some: { role: { name: { in: [...STAFF_ROLES] } } } } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Change a user's own name and sign-in email. */
  async updateProfile(id: string, data: { name: string | null; email: string }): Promise<void> {
    await this.db.user.update({ where: { id }, data: { name: data.name, email: data.email } });
  }

  /** Replace a user's password hash — used by the reset flow. */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { passwordHash } });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async softDelete(id: string): Promise<User> {
    return this.db.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /**
   * Self-service "delete my account": deactivates the account using the same
   * isActive/deletedAt pattern as softDelete (already treated as signed-out by
   * the jwt callback in apps/web/auth.ts and by the credentials login check),
   * and scrubs the live identity fields from the User row itself.
   *
   * Deliberately does not touch Order, Payment, Address, or any other related
   * rows — those are retained for financial/tax record-keeping and order
   * history, per the privacy policy. Email is replaced with a placeholder
   * derived from the user's own id, which is unique, so this can never
   * collide with another user's row and can safely run more than once.
   */
  async anonymizeAndDeactivate(id: string): Promise<User> {
    return this.db.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        name: 'Deleted user',
        email: `deleted-${id}@deleted.invalid`,
        phone: null,
        marketingConsent: false,
        newsletterSubscribed: false,
      },
    });
  }

  /**
   * Restore an archived customer. Archiving also turned the account off, so
   * restoring switches it back on. There is no record of whether an account
   * was deactivated on purpose before it was archived, so an admin who wants
   * it to stay off should deactivate it again after restoring.
   */
  async restore(id: string): Promise<User> {
    return this.db.user.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }

  async toggleActive(id: string, isActive: boolean): Promise<User> {
    return this.db.user.update({ where: { id }, data: { isActive } });
  }

  async delete(id: string): Promise<User> {
    return this.db.user.delete({ where: { id } });
  }

  async bulkSoftDelete(ids: string[]): Promise<number> {
    const r = await this.db.user.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), isActive: false },
    });
    return r.count;
  }

  async bulkRestore(ids: string[]): Promise<number> {
    const r = await this.db.user.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null, isActive: true },
    });
    return r.count;
  }
}
