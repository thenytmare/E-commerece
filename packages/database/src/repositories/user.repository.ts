import type { Prisma, User, RoleName } from '@prisma/client';
import { BaseRepository } from './base.repository';

const userWithRoles = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRoles }>;

/**
 * Data access for user accounts and role assignments.
 */
export class UserRepository extends BaseRepository {
  /** Find a user by email with their roles loaded */
  findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { email },
      include: userWithRoles,
    });
  }

  /** Find a user by ID with their roles loaded */
  findById(id: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { id },
      include: userWithRoles,
    });
  }

  /** Create a new user record */
  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.db.user.create({ data });
  }

  /** Create a user with a hashed password and assign the CUSTOMER role */
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
    if (!withRoles) {
      throw new Error('Failed to load user after creation');
    }
    return withRoles;
  }

  /** Assign a role to a user by role name */
  async assignRole(userId: string, roleName: RoleName): Promise<void> {
    const role = await this.db.role.findUniqueOrThrow({ where: { name: roleName } });
    await this.db.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }
}
