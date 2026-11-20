'use server';

import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { requirePermission } from './auth';
import { getClientIp } from '@/lib/request-context';
import { RETRYABLE_JOB_TYPES } from '@/lib/jobs/handlers';

const repos = createRepositories();

/** Put a failed job back in the queue. Only for types that are safe to repeat by hand. */
export async function retryJobAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await requirePermission('settings.write');
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
    return { success: false, error: 'Unknown job.' };
  }

  const retried = await repos.job.retry(id, RETRYABLE_JOB_TYPES);
  if (!retried) {
    return { success: false, error: 'This job cannot be retried. It may have been retried already.' };
  }

  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: 'job.retry',
    entity: 'Job',
    entityId: id,
  });
  revalidatePath('/admin/settings/jobs');
  return { success: true };
}
