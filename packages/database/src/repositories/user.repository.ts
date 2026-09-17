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
        wishlists: { take: 5, include: { product: { select: { id: true, name: true, slug: true } } } },
      },
    });
  }

  async adminFindMany(options?: {
    search?: string;
    isActive?: boolean;
    isDeleted?: boolean;
    role?: RoleName;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminUserListItem[]; total: number }> {
    const where: Prisma.UserWhereInput = {};

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
      where.roles = { some: { role: { name: options.role } } };
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
      this.db.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(new Date().setDate(1)) } } }),
      this.db.user.count({ where: { deletedAt: null, roles: { some: { role: { name: 'CUSTOMER' } } } } }),
      this.db.user.count({ where: { deletedAt: null, roles: { some: { role: { name: { in: ['ADMIN', 'MANAGER', 'SUPPORT'] } } } } } }),
    ]);
    return { total, active, inactive: total - active, newThisMonth, customers, admins };
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.db.user.create({ data });
  }

  async createWithPassword(data: { email: string; passwordHash: string; name?: string }): Promise<UserWithRoles> {
    const user = await this.create({ email: data.email, passwordHash: data.passwordHash, name: data.name });
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

  async restore(id: string): Promise<User> {
    return this.db.user.update({ where: { id }, data: { deletedAt: null } });
  }

  async toggleActive(id: string, isActive: boolean): Promise<User> {
    return this.db.user.update({ where: { id }, data: { isActive } });
  }

  async delete(id: string): Promise<User> {
    return this.db.user.delete({ where: { id } });
  }

  async bulkSoftDelete(ids: string[]): Promise<number> {
    const r = await this.db.user.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), isActive: false } });
    return r.count;
  }

  async bulkRestore(ids: string[]): Promise<number> {
    const r = await this.db.user.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
    return r.count;
  }
}