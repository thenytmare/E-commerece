import { BaseRepository } from './base.repository';

/**
 * Data access for audit logs.
 */
export class AuditLogRepository extends BaseRepository {
  /** List recent audit log entries */
  listRecent(limit = 20) {
    return this.db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: true },
    });
  }

  /** Create a new audit log entry */
  create(data: {
    action: string;
    entity: string;
    entityId?: string;
    actorId?: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return this.db.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        actorId: data.actorId,
        metadata: data.metadata ?? undefined,
        ipAddress: data.ipAddress,
      },
    });
  }
}
