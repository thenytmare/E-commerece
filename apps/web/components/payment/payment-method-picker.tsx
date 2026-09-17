'use client';

import {
  initiateMpesaPaymentAction,
  initiateStripePaymentAction,
  simulatePaymentAction,
  type PaymentActionState,
} from '@/lib/actions/payment';
import { formatPrice } from '@/lib/format';
import { Button, Input, Text } from '@repo/ui';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { MpesaPaymentStatus } from './mpesa-payment-status';

const initialState: PaymentActionState = {};

interface PaymentMethodPickerProps {
  orderNumber: string;
  /**
   * Plain number, not Prisma's Decimal. Decimal instances can't cross the
   * server/client boundary — React rejects them as non-plain objects — so the
   * page converts before passing.
   */
  total: number;
  stripeEnabled: boolean;
  mpesaEnabled: boolean;
  devMode: boolean;
  cancelled?: boolean;
}

export function PaymentMethodPicker({
  orderNumber,
  total,
  stripeEnabled,
  mpesaEnabled,
  devMode,
  cancelled,
}: PaymentMethodPickerProps) {
  const [mpesaState, mpesaAction, mpesaPending] = useActionState(
    initiateMpesaPaymentAction,
    initialState
  );
  const [isStripePending, startStripeTransition] = useTransition();
  const [isSimulating, startSimulateTransition] = useTransition();

  // Once an STK push is accepted we swap the form for the live status panel.
  const [trackingPaymentId, setTrackingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (mpesaState?.paymentId) {
      setTrackingPaymentId(mpesaState.paymentId);
    }
  }, [mpesaState?.paymentId]);

  const handleStripe = () => {
    startStripeTransition(async () => {
      await initiateStripePaymentAction(orderNumber);
    });
  };

  const handleSimulate = (provider: 'STRIPE' | 'MPESA') => {
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

      {stripeEnabled ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <Text className="mb-3 font-semibold">Pay with card</Text>
          <Text variant="muted" className="mb-4 text-sm">
            Secure checkout powered by Stripe (Visa, Mastercard, etc.)
          </Text>
          <Button onClick={handleStripe} isLoading={isStripePending} className="w-full">
            Pay with card
          </Button>
        </div>
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

      {devMode ? (
        <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-6">
          <Text className="mb-2 font-semibold">Development mode</Text>
          <Text variant="muted" className="mb-4 text-sm">
            Provider keys are not configured. Simulate a successful payment below.
          </Text>
          <div className="flex flex-wrap gap-3">
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

      {!stripeEnabled && !mpesaEnabled && !devMode ? (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <Text variant="muted">No payment methods are configured. Contact support.</Text>
        </div>
      ) : null}
    </div>
  );
}
