import type { Brand, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

/**
 * Data access for product brands.
 */
export class BrandRepository extends BaseRepository {
  /** Find an active brand by URL slug */
  findBySlug(slug: string): Promise<Brand | null> {
    return this.db.brand.findFirst({
      where: { slug, isActive: true },
    });
  }

  /** List all active brands ordered by name */
  findAllActive(): Promise<Brand[]> {
    return this.db.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Create a new brand */
  create(data: Prisma.BrandCreateInput): Promise<Brand> {
    return this.db.brand.create({ data });
  }
}
