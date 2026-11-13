import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { InfoCard } from '@/components/admin/ui/AdminPrimitives';
import { describeMailSettings } from '@/lib/mail';
import { RETRYABLE_JOB_TYPES } from '@/lib/jobs/handlers';
import { JobFailuresClient } from './JobFailuresClient';
import { SendTestEmail } from './SendTestEmail';

export const metadata = { title: 'Background Jobs | Admin' };
export const dynamic = 'force-dynamic';

const DELAY_WARNING_SECONDS = 10 * 60;

const JOB_NAMES: Record<string, string> = {
  'auth.password-reset-email': 'Password reset email',
  'order.confirmation-email': 'Order confirmation email',
  'back-in-stock.email': 'Back in stock email',
  'payments.reconcile': 'Payment check',
};

function waited(seconds: number | null): string {
  if (seconds === null) return 'None';
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

export default async function JobsPage() {
  // Error text can include a customer's email address, so admins only.
  const session = await requirePermission('settings.write');
  const stats = await createRepositories().job.stats();
  const mail = describeMailSettings();
  const mailReady = mail.configured;
  const workerOn = process.env.JOBS_WORKER !== 'false';
  const delayed = stats.oldestPendingSeconds !== null && stats.oldestPendingSeconds > DELAY_WARNING_SECONDS;

  return (
    <AdminPage
      title="Background Jobs"
      description="Emails and checks that run in the background, so customers never wait for them."
    >
      <div className="flex flex-col gap-6">
        {!mailReady && (
          <p role="status" className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-foreground">
            Email is not set up. Order and back in stock emails are skipped. Password reset emails fail until it is set.
          </p>
        )}
        {delayed && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            The oldest job has waited {waited(stats.oldestPendingSeconds)}. Check that the app is running and that JOBS_WORKER is not set to false on every server.
          </p>
        )}
        {!workerOn && (
          <p role="status" className="rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
            The worker is switched off on this server (JOBS_WORKER=false). Another server must run it.
          </p>
        )}

        <SendTestEmail configured={mail.configured} server={mail.server} from={mail.from} to={session.user.email ?? ''} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <InfoCard title="Waiting" value={stats.counts.PENDING} />
          <InfoCard title="Running" value={stats.counts.RUNNING} />
          <InfoCard title="Done (last 14 days)" value={stats.counts.DONE} />
          <InfoCard title="Failed" value={stats.counts.FAILED} />
          <InfoCard title="Oldest waiting" value={waited(stats.oldestPendingSeconds)} />
        </div>

        <section aria-labelledby="failures-heading" className="flex flex-col gap-3">
          <h2 id="failures-heading" className="text-lg font-semibold text-foreground">
            Recent failures
          </h2>
          <JobFailuresClient
            failures={stats.recentFailures.map((f) => ({
              id: f.id,
              name: JOB_NAMES[f.type] ?? f.type,
              attempts: f.attempts,
              lastError: f.lastError,
              failedAt: f.updatedAt.toISOString(),
              canRetry: RETRYABLE_JOB_TYPES.includes(f.type),
            }))}
          />
        </section>
      </div>
    </AdminPage>
  );
}
