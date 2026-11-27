import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { ActivityLogClient } from './ActivityLogClient';

export const metadata = { title: 'Activity Log | Admin' };

export default async function ActivityLogPage() {
  await requirePermission('analytics.read');
  const repos = createRepositories();
  const logs = await repos.auditLog.listRecent(100);

  return (
    <AdminPage title="Activity Log" description="Track all admin actions and system events across the store.">
      <ActivityLogClient logs={logs.map(l => ({
        ...l,
        actor: l.actor ? { name: l.actor.name ?? 'Unknown', email: l.actor.email } : null,
        metadata: l.metadata as Record<string, unknown> | null,
        createdAt: l.createdAt.toISOString(),
      }))} />
    </AdminPage>
  );
}