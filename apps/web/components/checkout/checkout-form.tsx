'use client';

import { placeOrderAction, type CheckoutActionState } from '@/lib/actions/checkout';
import type { Address } from '@repo/database';
import { Button, Input, Text } from '@repo/ui';
import { useActionState, useState } from 'react';

const initialState: CheckoutActionState = {};

interface CheckoutFormProps {
  addresses: Address[];
}

export function CheckoutForm({ addresses }: CheckoutFormProps) {
  const [state, action, pending] = useActionState(placeOrderAction, initialState);
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddress?.id ?? '');
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);

  return (
    <form action={action} className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <Text className="mb-4 font-semibold">Shipping Address</Text>

        {addresses.length > 0 ? (
          <div className="mb-6 space-y-3">
            {addresses.map((address) => (
              <label
                key={address.id}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                  !useNewAddress && selectedAddressId === address.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="addressId"
                  value={address.id}
                  checked={!useNewAddress && selectedAddressId === address.id}
                  disabled={useNewAddress}
                  onChange={() => {
                    setUseNewAddress(false);
                    setSelectedAddressId(address.id);
                  }}
                  className="mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium">{address.name}</p>
                  <p className="text-muted-foreground">{address.phone}</p>
                  <p className="text-muted-foreground">
                    {address.street}, {address.city}, {address.county}
                  </p>
                </div>
              </label>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUseNewAddress(true)}
            >
              Use a new address
            </Button>
          </div>
        ) : null}

        {useNewAddress || addresses.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="name"
              label="Full name"
              required
              disabled={pending}
              error={state?.fieldErrors?.name}
              className="sm:col-span-2"
            />
            <Input
              name="phone"
              label="Phone"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              required
              disabled={pending}
              error={state?.fieldErrors?.phone}
            />
            <Input
              name="county"
              label="County"
              required
              disabled={pending}
              error={state?.fieldErrors?.county}
            />
            <Input
              name="city"
              label="City / Town"
              required
              disabled={pending}
              error={state?.fieldErrors?.city}
            />
            <Input
              name="street"
              label="Street address"
              required
              disabled={pending}
              error={state?.fieldErrors?.street}
              className="sm:col-span-2"
            />
            <Input
              name="postalCode"
              label="Postal code (optional)"
              disabled={pending}
              error={state?.fieldErrors?.postalCode}
              className="sm:col-span-2"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <Input
          name="notes"
          label="Order notes (optional)"
          placeholder="Delivery instructions, gate code, etc."
          disabled={pending}
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" isLoading={pending}>
        Continue to payment
      </Button>
    </form>
  );
}
