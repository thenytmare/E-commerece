'use client';

import { useState, useTransition } from 'react';
import { sendTestEmailAction } from '@/lib/actions/admin-mail';

interface Props {
  configured: boolean;
  server: string | null;
  from: string;
  to: string;
}

export function SendTestEmail({ configured, server, from, to }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const send = () => {
    setResult(null);
    startTransition(async () => setResult(await sendTestEmailAction()));
  };

  return (
    <section aria-labelledby="email-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 id="email-heading" className="text-lg font-semibold text-foreground">
        Email
      </h2>
      {configured ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Mail server</dt>
          <dd className="break-all font-mono text-foreground">{server}</dd>
          <dt className="text-muted-foreground">Sent from</dt>
          <dd className="break-all text-foreground">{from}</dd>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not set up. Add SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM on the server, then restart the app.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={send}
          disabled={pending || !configured}
          className="min-h-[44px] rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {pending ? 'Sending...' : 'Send test email'}
        </button>
        <p className="text-sm text-muted-foreground">It goes to your own address: {to}</p>
      </div>
      {result && (
        <p
          role={result.success ? 'status' : 'alert'}
          className={
            result.success
              ? 'rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-foreground'
              : 'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground'
          }
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
