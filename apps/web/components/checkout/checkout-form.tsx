'use client';

import { placeOrderAction, type CheckoutActionState } from '@/lib/actions/checkout';
import { validateCouponAction } from '@/lib/actions/coupon';
import type { Address } from '@repo/database';
import { Button, Input, Text } from '@repo/ui';
import { useActionState, useState } from 'react';
import type { AppliedCoupon } from './CheckoutClient';

const initialState: CheckoutActionState = {};

interface CheckoutFormProps {
  isGuest: boolean;
  addresses: Address[];
  subtotal: number;
  appliedCoupon: AppliedCoupon | null;
  onCouponApplied: (coupon: AppliedCoupon | null) => void;
}

export function CheckoutForm({ isGuest, addresses, subtotal, appliedCoupon, onCouponApplied }: CheckoutFormProps) {
  const [state, action, pending] = useActionState(placeOrderAction, initialState);
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddress?.id ?? '');
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    setCouponError(null);
    const result = await validateCouponAction(couponInput.trim(), subtotal);
    setCheckingCoupon(false);
    if (!result.valid) {
      setCouponError(result.error ?? 'Invalid coupon code');
      onCouponApplied(null);
      return;
    }
    onCouponApplied({ code: result.code!, discount: result.discount! });
  };

  const handleRemoveCoupon = () => {
    onCouponApplied(null);
    setCouponInput('');
    setCouponError(null);
  };

  return (
    <form action={action} className="order-2 space-y-8 lg:order-none">
      {isGuest ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <Text className="mb-1 font-semibold">Contact</Text>
          <Text variant="muted" className="mb-4 text-sm">
            We&apos;ll send your receipt and delivery updates here.{' '}
            <a href="/login?callbackUrl=/checkout" className="underline underline-offset-4">
              Sign in
            </a>{' '}
            if you already have an account.
          </Text>
          <Input
            name="guestEmail"
            type="email"
            label="Email address"
            autoComplete="email"
            required
            disabled={pending}
            error={state?.fieldErrors?.guestEmail}
          />
        </div>
      ) : null}

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
              autoComplete="name"
              label="Full name"
              required
              disabled={pending}
              error={state?.fieldErrors?.name}
              className="sm:col-span-2"
            />
            <Input
              name="phone"
              autoComplete="tel"
              label="Phone"
              type="tel"
              placeholder="+254 7XX XXX XXX"
              required
              disabled={pending}
              error={state?.fieldErrors?.phone}
            />
            <Input
              name="county"
              autoComplete="address-level1"
              label="County"
              required
              disabled={pending}
              error={state?.fieldErrors?.county}
            />
            <Input
              name="city"
              autoComplete="address-level2"
              label="City / Town"
              required
              disabled={pending}
              error={state?.fieldErrors?.city}
            />
            <Input
              name="street"
              autoComplete="street-address"
              label="Street address"
              required
              disabled={pending}
              error={state?.fieldErrors?.street}
              className="sm:col-span-2"
            />
            <Input
              name="postalCode"
              autoComplete="postal-code"
              label="Postal code (optional)"
              disabled={pending}
              error={state?.fieldErrors?.postalCode}
              className="sm:col-span-2"
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <Text className="mb-4 font-semibold">Coupon Code</Text>
        <input type="hidden" name="couponCode" value={appliedCoupon?.code ?? ''} />
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm">
              <span className="font-medium">{appliedCoupon.code}</span> applied
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleRemoveCoupon} disabled={pending}>
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Enter coupon code"
              aria-label="Coupon code"
              disabled={pending || checkingCoupon}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyCoupon}
              disabled={pending || checkingCoupon || !couponInput.trim()}
              isLoading={checkingCoupon}
            >
              Apply
            </Button>
          </div>
        )}
        {couponError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {couponError}
          </p>
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
