import type { Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class SiteSettingRepository extends BaseRepository {
  async findByKey(key: string) {
    return this.db.siteSetting.findUnique({ where: { key } });
  }

  async upsert(key: string, value: Prisma.InputJsonValue) {
    return this.db.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}