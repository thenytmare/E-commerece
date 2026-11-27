'use client';

import {
  chooseCashOnDeliveryAction,
  initiateMpesaPaymentAction,
  initiatePaystackPaymentAction,
  initiateStripePaymentAction,
  simulatePaymentAction,
  submitManualMpesaAction,
  type PaymentActionState,
} from '@/lib/actions/payment';
import { formatPrice } from '@/lib/format';
import { Button, Input, Text } from '@repo/ui';
import { Check, Copy } from 'lucide-react';
import { useActionState, useEffect, useState, useTransition, type ReactNode } from 'react';
import { MpesaPaymentStatus } from './mpesa-payment-status';

const initialState: PaymentActionState = {};

export type ManualMpesaConfig = {
  businessName: string;
  paybillNumber: string;
  accountNumber: string;
  accountName: string;
  contactPhone: string;
  instructions: string;
};

interface PaymentMethodPickerProps {
  initialPaymentId?: string;
  orderNumber: string;
  /**
   * Plain number, not Prisma's Decimal. Decimal instances can't cross the
   * server/client boundary — React rejects them as non-plain objects — so the
   * page converts before passing.
   */
  total: number;
  stripeEnabled: boolean;
  mpesaEnabled: boolean;
  paystackEnabled?: boolean;
  /** Cash on Delivery — Nairobi deliveries only. */
  codEnabled: boolean;
  /** Manual M-Pesa Paybill config, or null when the method is off. */
  manualMpesa?: ManualMpesaConfig | null;
  /** State of this order's existing manual submission, if any. */
  manualStatus?: 'AWAITING_CONFIRMATION' | 'FAILED' | null;
  devMode: boolean;
  cancelled?: boolean;
  /** Trust badge shown under the M-Pesa prompt. Built on the server, so it is passed in. */
  mpesaBadge?: ReactNode;
  /** "Secured by Paystack" badge shown under the Paystack option. */
  paystackBadge?: ReactNode;
}

/** A copyable value row for the Paybill card. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). The value is
      // visible on screen, so the customer can still type it.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <Text variant="muted" className="text-xs">
          {label}
        </Text>
        <Text className="font-mono text-base font-semibold tabular-nums tracking-wide">{value}</Text>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function PaymentMethodPicker({
  initialPaymentId,
  orderNumber,
  total,
  stripeEnabled,
  mpesaEnabled,
  paystackEnabled,
  codEnabled,
  manualMpesa,
  manualStatus,
  devMode,
  cancelled,
  mpesaBadge,
  paystackBadge,
}: PaymentMethodPickerProps) {
  const [manualState, manualSubmitAction, manualPending] = useActionState(
    submitManualMpesaAction,
    initialState
  );
  const [mpesaState, mpesaAction, mpesaPending] = useActionState(
    initiateMpesaPaymentAction,
    initialState
  );
  const [isStripePending, startStripeTransition] = useTransition();
  const [isPaystackPending, startPaystackTransition] = useTransition();
  const [isSimulating, startSimulateTransition] = useTransition();
  const [isCodPending, startCodTransition] = useTransition();
  const [codError, setCodError] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [paystackError, setPaystackError] = useState<string | null>(null);

  // Once an STK push is accepted we swap the form for the live status panel.
  const [trackingPaymentId, setTrackingPaymentId] = useState<string | null>(initialPaymentId ?? null);

  useEffect(() => {
    if (mpesaState?.paymentId) {
      setTrackingPaymentId(mpesaState.paymentId);
    }
  }, [mpesaState]);

  const handlePaystack = () => {
    setPaystackError(null);
    startPaystackTransition(async () => {
      try {
        const result = await initiatePaystackPaymentAction(orderNumber);
        if (result?.error) setPaystackError(result.error);
      } catch (error) {
        if (error && typeof error === 'object' && 'digest' in error) throw error;
        setPaystackError('Could not start Paystack checkout. Please try again.');
      }
    });
  };

  const handleStripe = () => {
    setStripeError(null);
    startStripeTransition(async () => {
      try {
        // On success the action redirects to Stripe and never returns. A
        // returned value is always a failure, so show it and keep the button
        // usable for another try.
        const result = await initiateStripePaymentAction(orderNumber);
        if (result?.error) setStripeError(result.error);
      } catch (error) {
        // Next.js redirects surface as a thrown signal. Let those through.
        if (error && typeof error === 'object' && 'digest' in error) throw error;
        setStripeError('Could not start card payment. Please try again.');
      }
    });
  };

  const handleCashOnDelivery = () => {
    setCodError(null);
    startCodTransition(async () => {
      const result = await chooseCashOnDeliveryAction(orderNumber);
      if (result?.error) setCodError(result.error);
    });
  };

  const handleSimulate = (provider: 'STRIPE' | 'MPESA' | 'PAYSTACK') => {
    startSimulateTransition(async () => {
      await simulatePaymentAction(orderNumber, provider);
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <Text className="mb-1 font-semibold">Amount due</Text>
        <Text className="text-2xl font-bold">{formatPrice(total)}</Text>
        <Text variant="muted" className="mt-1 text-sm">
          Order {orderNumber}
        </Text>
      </div>

      {cancelled ? (
        <p className="text-sm text-muted-foreground" role="status">
          Payment was cancelled. Choose a method below to try again.
        </p>
      ) : null}

      {mpesaEnabled ? (
        trackingPaymentId ? (
          <MpesaPaymentStatus
            paymentId={trackingPaymentId}
            orderNumber={orderNumber}
            onRetry={() => setTrackingPaymentId(null)}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <Text className="mb-3 font-semibold">Pay with M-Pesa</Text>
            <Text variant="muted" className="mb-4 text-sm">
              You will receive an STK push on your phone to enter your PIN.
            </Text>
            <form action={mpesaAction} className="space-y-4">
              <input type="hidden" name="orderNumber" value={orderNumber} />
              <Input
                name="phone"
                label="M-Pesa phone number"
                type="tel"
                placeholder="07XX XXX XXX"
                required
                disabled={mpesaPending}
              />
              {mpesaState?.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {mpesaState.error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" isLoading={mpesaPending}>
                Send STK push
              </Button>
            </form>
          </div>
        )
      ) : null}

      {mpesaEnabled ? (
        <div className="empty:hidden">{mpesaBadge}</div>
      ) : null}

      {manualMpesa ? (
        manualStatus === 'AWAITING_CONFIRMATION' || manualState.success ? (
          <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-6">
            <Text className="mb-1 font-semibold text-green-700 dark:text-green-400">
              Payment received — awaiting confirmation
            </Text>
            <Text variant="muted" className="text-sm">
              {manualState.success ??
                'We have your M-Pesa code and are checking it against our records. Your order will be confirmed shortly — you can safely close this page.'}
            </Text>
            {manualMpesa.contactPhone ? (
              <Text variant="muted" className="mt-3 text-sm">
                Need help? Call or WhatsApp{' '}
                <span className="font-medium text-foreground">{manualMpesa.contactPhone}</span>.
              </Text>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                M-PESA
              </span>
              <Text className="font-semibold">Pay via M-Pesa Paybill</Text>
            </div>

            {manualMpesa.businessName ? (
              <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2">
                <Text variant="muted" className="text-xs">
                  Paying to
                </Text>
                <Text className="text-base font-semibold">{manualMpesa.businessName}</Text>
              </div>
            ) : null}

            <div className="space-y-2">
              <CopyRow label="Paybill (business number)" value={manualMpesa.paybillNumber} />
              <CopyRow label="Account number" value={manualMpesa.accountNumber} />
              {manualMpesa.accountName ? (
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <Text variant="muted" className="text-xs">
                    Account name
                  </Text>
                  <Text className="text-base font-semibold">{manualMpesa.accountName}</Text>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <div>
                  <Text variant="muted" className="text-xs">
                    Amount
                  </Text>
                  <Text className="text-base font-semibold tabular-nums">{formatPrice(total)}</Text>
                </div>
              </div>
            </div>

            <ol className="mt-5 space-y-1.5 text-sm text-muted-foreground">
              <li>1. On your phone, open <span className="font-medium text-foreground">M-Pesa → Lipa na M-Pesa → Pay Bill</span>.</li>
              <li>2. Enter business number <span className="font-medium text-foreground">{manualMpesa.paybillNumber}</span> and account <span className="font-medium text-foreground">{manualMpesa.accountNumber}</span>.</li>
              <li>3. Enter the amount <span className="font-medium text-foreground">{formatPrice(total)}</span> and your M-Pesa PIN.</li>
              <li>4. Copy the confirmation SMS from M-Pesa and paste it below.</li>
            </ol>

            {manualMpesa.instructions ? (
              <Text variant="muted" className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                {manualMpesa.instructions}
              </Text>
            ) : null}

            {manualStatus === 'FAILED' ? (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-400" role="status">
                We could not verify your previous code. Please check the M-Pesa message and submit it again.
              </p>
            ) : null}

            <form action={manualSubmitAction} className="mt-5 space-y-3">
              <input type="hidden" name="orderNumber" value={orderNumber} />
              <label htmlFor="mpesaMessage" className="block text-sm font-medium">
                Paste your M-Pesa confirmation
              </label>
              <textarea
                id="mpesaMessage"
                name="mpesaMessage"
                required
                rows={3}
                disabled={manualPending}
                placeholder="e.g. SGH4K8L2MN Confirmed. Ksh1,500.00 sent to..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {manualState.error ? (
                <p className="text-sm text-destructive" role="alert">
                  {manualState.error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" isLoading={manualPending}>
                I have paid — confirm my order
              </Button>
            </form>
          </div>
        )
      ) : null}

      {paystackEnabled ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-2 flex items-center justify-between">
            <Text className="font-semibold">Pay with Paystack</Text>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded bg-blue-600/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                Card
              </span>
              <span className="inline-flex items-center rounded bg-green-600/10 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                M-Pesa
              </span>
            </div>
          </div>
          <Text variant="muted" className="mb-4 text-sm">
            Fast, secure checkout via Paystack. Pay easily with Card (Visa, Mastercard) or M-Pesa.
          </Text>
          <Button onClick={handlePaystack} isLoading={isPaystackPending} className="w-full">
            Pay with Paystack
          </Button>
          {paystackError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {paystackError} You can try again, or choose another method.
            </p>
          ) : null}
          <div className="mt-4 empty:hidden">{paystackBadge}</div>
        </div>
      ) : null}

      {stripeEnabled ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <Text className="mb-3 font-semibold">Pay with card</Text>
          <Text variant="muted" className="mb-4 text-sm">
            Secure checkout powered by Stripe (Visa, Mastercard, etc.)
          </Text>
          <Button onClick={handleStripe} isLoading={isStripePending} className="w-full">
            Pay with card
          </Button>
          {stripeError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {stripeError} You can try again, or choose another method.
            </p>
          ) : null}
        </div>
      ) : null}

      {codEnabled ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <Text className="mb-3 font-semibold">Cash on Delivery</Text>
          <Text variant="muted" className="mb-4 text-sm">
            Pay the rider in cash when your order arrives. Available for Nairobi deliveries.
          </Text>
          {codError ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {codError}
            </p>
          ) : null}
          <Button
            variant="outline"
            onClick={handleCashOnDelivery}
            isLoading={isCodPending}
            className="w-full"
          >
            Pay on delivery
          </Button>
        </div>
      ) : null}

      {devMode ? (
        <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-6">
          <Text className="mb-2 font-semibold">Development mode</Text>
          <Text variant="muted" className="mb-4 text-sm">
            Provider keys are not configured. Simulate a successful payment below.
          </Text>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleSimulate('PAYSTACK')}
              isLoading={isSimulating}
            >
              Simulate Paystack
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSimulate('STRIPE')}
              isLoading={isSimulating}
            >
              Simulate card payment
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSimulate('MPESA')}
              isLoading={isSimulating}
            >
              Simulate M-Pesa payment
            </Button>
          </div>
        </div>
      ) : null}

      {!stripeEnabled && !mpesaEnabled && !paystackEnabled && !codEnabled && !manualMpesa && !devMode ? (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <Text variant="muted">No payment methods are configured. Contact support.</Text>
        </div>
      ) : null}
    </div>
  );
}
