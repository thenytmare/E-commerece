'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Text } from '@repo/ui';

/** Poll interval and cap — an STK prompt expires after roughly a minute. */
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_MS = 150_000;

type PaymentStatusResponse = {
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  receiptNumber: string | null;
  failureReason: string | null;
  orderNumber: string;
  terminal: boolean;
};

type UiState = 'waiting' | 'success' | 'failed' | 'timeout';

interface Props {
  paymentId: string;
  orderNumber: string;
  onRetry: () => void;
}

/**
 * Shows the real outcome of an STK push by polling the status endpoint.
 *
 * The customer is never told "paid" off the back of the STK request itself —
 * only a server-verified COMPLETED status flips this to success.
 */
export function MpesaPaymentStatus({ paymentId, orderNumber, onRetry }: Props) {
  const router = useRouter();
  const [state, setState] = useState<UiState>('waiting');
  const [detail, setDetail] = useState<PaymentStatusResponse | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        setState('timeout');
        return;
      }

      try {
        const res = await fetch(`/api/payments/${paymentId}/status`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as PaymentStatusResponse;
          if (cancelled) return;
          setDetail(data);

          if (data.status === 'COMPLETED') {
            setState('success');
            // Let the order pages pick up the confirmed status.
            router.refresh();
            return;
          }
          if (data.status === 'FAILED') {
            setState('failed');
            return;
          }
        }
      } catch {
        // Transient network problem — keep polling until the cap.
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paymentId, router]);

  if (state === 'success') {
    return (
      <div className="rounded-xl border border-green-600/30 bg-green-600/5 p-6 space-y-3">
        <Text className="font-semibold text-green-700">Payment received</Text>
        <Text variant="muted" className="text-sm">
          {detail?.receiptNumber
            ? `M-Pesa receipt ${detail.receiptNumber}.`
            : 'Your payment has been confirmed.'}
        </Text>
        <Button asChild className="w-full">
          <a href={`/orders/${orderNumber}?paid=1`}>View your order</a>
        </Button>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <Text className="font-semibold text-destructive">Payment not completed</Text>
        <Text variant="muted" className="text-sm">
          {detail?.failureReason ?? 'The payment was not completed.'}
        </Text>
        <Button variant="outline" onClick={onRetry} className="w-full">
          Try again
        </Button>
      </div>
    );
  }

  if (state === 'timeout') {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 space-y-3">
        <Text className="font-semibold">Still waiting for confirmation</Text>
        <Text variant="muted" className="text-sm">
          We haven&apos;t had a result from M-Pesa yet. If you completed the payment it will
          appear on your order shortly — refresh this page in a moment. Otherwise you can try
          again.
        </Text>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <Text className="font-semibold">Check your phone</Text>
      </div>
      <Text variant="muted" className="text-sm">
        Enter your M-Pesa PIN on the prompt to complete payment. This page updates automatically
        — don&apos;t close it.
      </Text>
    </div>
  );
}
