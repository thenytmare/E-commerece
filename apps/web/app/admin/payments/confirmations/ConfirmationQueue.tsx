'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format';
import {
  confirmManualPaymentAction,
  rejectManualPaymentAction,
} from '@/lib/actions/admin-payments';

export type PendingManualPayment = {
  id: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customer: string;
  code: string;
  payerPhone: string | null;
  rawMessage: string | null;
  submittedAt: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

function PaymentRow({ payment }: { payment: PendingManualPayment }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await confirmManualPaymentAction(payment.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const reject = () => {
    setError(null);
    startTransition(async () => {
      const res = await rejectManualPaymentAction(payment.id, reason);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/orders?q=${encodeURIComponent(payment.orderNumber)}`}
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              {payment.orderNumber}
            </Link>
            <span className="text-xs text-muted-foreground">· {timeAgo(payment.submittedAt)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{payment.customer}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
            <span className="font-mono font-semibold tracking-wide text-foreground">
              {payment.code}
            </span>
            {payment.payerPhone ? (
              <span className="text-muted-foreground">{payment.payerPhone}</span>
            ) : null}
            <span className="font-semibold tabular-nums">{formatPrice(payment.amount)}</span>
          </div>
        </div>

        {!rejecting ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={isPending}
              className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Working…' : 'Confirm payment'}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>

      {payment.rawMessage ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            View submitted M-Pesa message
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {payment.rawMessage}
          </p>
        </details>
      ) : null}

      {rejecting ? (
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-background p-3">
          <label htmlFor={`reason-${payment.id}`} className="block text-sm font-medium">
            Reason for rejecting (shown in the audit log)
          </label>
          <input
            id={`reason-${payment.id}`}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Code not found in M-Pesa statement"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reject}
              disabled={isPending}
              className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Working…' : 'Confirm rejection'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ConfirmationQueue({ payments }: { payments: PendingManualPayment[] }) {
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-10 text-center">
        <p className="font-medium text-foreground">No payments waiting</p>
        <p className="mt-1 text-sm text-muted-foreground">
          M-Pesa Paybill submissions appear here for you to verify and confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {payments.length} payment{payments.length === 1 ? '' : 's'} waiting. Verify each M-Pesa code
        against your statement before confirming.
      </p>
      {payments.map((p) => (
        <PaymentRow key={p.id} payment={p} />
      ))}
    </div>
  );
}
