'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { getClientIp } from '@/lib/request-context';
import { rateLimit } from '@/lib/rate-limit';
import { sendTestEmail } from '@/lib/mail';

const repos = createRepositories();

/**
 * Sends one test email to the signed-in admin's own address. It never takes a
 * recipient from the form, so it cannot be used to send mail to anyone else.
 */
export async function sendTestEmailAction(): Promise<{ success: boolean; message: string }> {
  const session = await requirePermission('settings.write');
  const to = session.user.email;
  if (!to) return { success: false, message: 'Your account has no email address to send to.' };

  const limit = await rateLimit(`mail-test:${session.user.id}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return {
      success: false,
      message: `That is 5 test emails in 10 minutes. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
    };
  }

  const result = await sendTestEmail(to);
  await repos.auditLog.create({
    actorId: session.user.id,
    ipAddress: (await getClientIp()) ?? undefined,
    action: result.ok ? 'mail.test_sent' : 'mail.test_failed',
    entity: 'Mail',
    entityId: 'smtp',
  });

  return result.ok
    ? { success: true, message: `Sent to ${to}. Check the inbox, and the spam folder if it is not there in a minute.` }
    : { success: false, message: result.error };
}
