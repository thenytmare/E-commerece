'use client';

import {
  initiateMpesaPaymentAction,
  initiateStripePaymentAction,
  simulatePaymentAction,
  type PaymentActionState,
} from '@/lib/actions/payment';
import { formatPrice } from '@/lib/format';
import type { OrderDetail } from '@repo/database';
import { Button, Input, Text } from '@repo/ui';
import { useActionState, useTransition } from 'react';

const initialState: PaymentActionState = {};

interface PaymentMethodPickerProps {
  order: OrderDetail;
  stripeEnabled: boolean;
  mpesaEnabled: boolean;
  devMode: boolean;
  cancelled?: boolean;
}

export function PaymentMethodPicker({
  order,
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

  const total =
    typeof order.total === 'object' && 'toNumber' in order.total
      ? order.total.toNumber()
      : Number(order.total);

  const handleStripe = () => {
    startStripeTransition(async () => {
      await initiateStripePaymentAction(order.orderNumber);
    });
  };

  const handleSimulate = (provider: 'STRIPE' | 'MPESA') => {
    startSimulateTransition(async () => {
      await simulatePaymentAction(order.orderNumber, provider);
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <Text className="mb-1 font-semibold">Amount due</Text>
        <Text className="text-2xl font-bold">{formatPrice(total)}</Text>
        <Text variant="muted" className="mt-1 text-sm">
          Order {order.orderNumber}
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
        <div className="rounded-xl border border-border bg-card p-6">
          <Text className="mb-3 font-semibold">Pay with M-Pesa</Text>
          <Text variant="muted" className="mb-4 text-sm">
            You will receive an STK push on your phone to enter your PIN.
          </Text>
          <form action={mpesaAction} className="space-y-4">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
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
            {mpesaState?.success ? (
              <p className="text-sm text-green-600" role="status">
                {mpesaState.success}
              </p>
            ) : null}
            <Button type="submit" className="w-full" isLoading={mpesaPending}>
              Send STK push
            </Button>
          </form>
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
