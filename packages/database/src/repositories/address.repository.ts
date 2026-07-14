import type { Address, AddressType, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface CreateAddressInput {
  name: string;
  phone: string;
  county: string;
  city: string;
  street: string;
  postalCode?: string;
  type?: AddressType;
  isDefault?: boolean;
}

/**
 * Data access for customer shipping and billing addresses.
 */
export class AddressRepository extends BaseRepository {
  /** List all addresses for a user, default first */
  findByUserId(userId: string): Promise<Address[]> {
    return this.db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Find an address owned by a specific user */
  findByIdForUser(id: string, userId: string): Promise<Address | null> {
    return this.db.address.findFirst({
      where: { id, userId },
    });
  }

  /** Create a new address for a user; first address becomes default */
  async createForUser(userId: string, input: CreateAddressInput): Promise<Address> {
    const existingCount = await this.db.address.count({ where: { userId } });
    const isDefault = existingCount === 0 ? true : (input.isDefault ?? false);

    if (isDefault) {
      await this.db.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.db.address.create({
      data: {
        userId,
        type: input.type ?? 'SHIPPING',
        name: input.name,
        phone: input.phone,
        county: input.county,
        city: input.city,
        street: input.street,
        postalCode: input.postalCode ?? null,
        isDefault,
      },
    });
  }
}

export type { Address };
