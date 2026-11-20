'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { EmptyState } from '@/components/admin/ui/EmptyState';
import { useToast } from '@/components/ui/toast';
import { retryJobAction } from '@/lib/actions/admin-jobs';
import { formatDateTime } from '@/lib/format';

export interface JobFailureRow {
  id: string;
  name: string;
  attempts: number;
  lastError: string | null;
  failedAt: string;
  canRetry: boolean;
}

export function JobFailuresClient({ failures }: { failures: JobFailureRow[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (failures.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No failures" description="Every background job has finished or is still trying." />;
  }

  const retry = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      const result = await retryJobAction(id);
      setBusyId(null);
      if (result.success) toast('Job queued again', 'success');
      else toast(result.error ?? 'Could not retry this job.', 'error');
    });
  };

  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
      {failures.map((f) => (
        <li key={f.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{f.name}</p>
            <p className="text-sm text-muted-foreground">
              Failed {formatDateTime(f.failedAt)} after {f.attempts} {f.attempts === 1 ? 'try' : 'tries'}
            </p>
            {f.lastError && (
              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{f.lastError}</p>
            )}
          </div>
          {f.canRetry ? (
            <button
              type="button"
              onClick={() => retry(f.id)}
              disabled={pending && busyId === f.id}
              className="min-h-[44px] shrink-0 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
              aria-label={`Retry ${f.name}`}
            >
              {pending && busyId === f.id ? 'Retrying...' : 'Retry'}
            </button>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground sm:max-w-[12rem]">
              Cannot be retried. The customer can ask for a new link.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
