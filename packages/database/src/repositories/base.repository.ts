import type { PrismaClient } from '@prisma/client';

/**
 * Base class for all repositories.
 * Provides shared database client access without business logic.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: PrismaClient) {}
}
