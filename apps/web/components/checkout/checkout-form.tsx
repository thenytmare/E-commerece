'use client';

import { placeOrderAction, type CheckoutActionState } from '@/lib/actions/checkout';
import { validateCouponAction } from '@/lib/actions/coupon';
import type { Address } from '@repo/database';
import { Button, Input, Text } from '@repo/ui';
import { useActionState, useState } from 'react';
import type { AppliedCoupon, DeliveryChoice } from './CheckoutClient';
import { DeliveryOptions } from './delivery-options';

const initialState: CheckoutActionState = {};

interface CheckoutFormProps {
  isGuest: boolean;
  addresses: Address[];
  subtotal: number;
  storeAddress: string;
  delivery: DeliveryChoice;
  onDeliveryChange: (value: DeliveryChoice) => void;
  appliedCoupon: AppliedCoupon | null;
  onCouponApplied: (coupon: AppliedCoupon | null) => void;
}

export function CheckoutForm({
  isGuest,
  addresses,
  subtotal,
  storeAddress,
  delivery,
  onDeliveryChange,
  appliedCoupon,
  onCouponApplied,
}: CheckoutFormProps) {
  const [state, action, pending] = useActionState(placeOrderAction, initialState);
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddress?.id ?? '');
  const [useNewAddress, setUseNewAddress] = useState(addresses.length === 0);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const zone = delivery.zone;
  const isPickup = zone === 'PICKUP';
  const deliveryReady = zone !== null && (isPickup || Boolean(delivery.location));
  // Saved addresses only make sense when something is being delivered.
  const showSavedAddresses = addresses.length > 0 && !isPickup;
  const showNewAddressFields = isPickup || useNewAddress || addresses.length === 0;

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
        <div className="border-border bg-card rounded-xl border p-6">
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

      <div className="border-border bg-card rounded-xl border p-6">
        <Text className="mb-4 font-semibold">Delivery Options</Text>
        <DeliveryOptions
          value={delivery}
          onChange={onDeliveryChange}
          storeAddress={storeAddress}
          disabled={pending}
          zoneError={state?.fieldErrors?.deliveryZone}
          locationError={state?.fieldErrors?.deliveryLocation}
        />
      </div>

      {zone ? (
        <div className="border-border bg-card rounded-xl border p-6">
          <Text className="mb-4 font-semibold">
            {isPickup ? 'Your Details' : 'Delivery Details'}
          </Text>

          {showSavedAddresses ? (
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

          {showNewAddressFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="name"
                autoComplete="name"
                label="Full name"
                required
                disabled={pending}
                error={state?.fieldErrors?.name}
              />
              <Input
                name="phone"
                autoComplete="tel"
                label="Phone"
                type="tel"
                placeholder="07XX XXX XXX"
                required
                disabled={pending}
                error={state?.fieldErrors?.phone}
              />
              {zone === 'OUTSIDE_NAIROBI' || zone === 'OUTSIDE_KENYA' ? (
                <Input
                  name="city"
                  autoComplete="address-level2"
                  label="Town / City"
                  required
                  disabled={pending}
                  error={state?.fieldErrors?.city}
                  className="sm:col-span-2"
                />
              ) : null}
              {!isPickup ? (
                <Input
                  name="street"
                  autoComplete="street-address"
                  label="Building, estate or landmark"
                  placeholder="e.g. Rhapta Heights, 3rd floor, near the Shell petrol station"
                  required
                  disabled={pending}
                  error={state?.fieldErrors?.street}
                  className="sm:col-span-2"
                />
              ) : null}
              {zone === 'OUTSIDE_KENYA' ? (
                <Input
                  name="postalCode"
                  autoComplete="postal-code"
                  label="Postal code (optional)"
                  disabled={pending}
                  error={state?.fieldErrors?.postalCode}
                  className="sm:col-span-2"
                />
              ) : null}
              {state?.fieldErrors?.county ? (
                <p className="text-destructive text-sm sm:col-span-2" role="alert">
                  {state.fieldErrors.county}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-border bg-card rounded-xl border p-6">
        <Text className="mb-4 font-semibold">Coupon Code</Text>
        <input type="hidden" name="couponCode" value={appliedCoupon?.code ?? ''} />
        {appliedCoupon ? (
          <div className="border-primary/30 bg-primary/5 flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-sm">
              <span className="font-medium">{appliedCoupon.code}</span> applied
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveCoupon}
              disabled={pending}
            >
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
          <p className="text-destructive mt-2 text-sm" role="alert">
            {couponError}
          </p>
        ) : null}
      </div>

      <div className="border-border bg-card rounded-xl border p-6">
        <Input
          name="notes"
          label="Order notes (optional)"
          placeholder="Delivery instructions, gate code, etc."
          disabled={pending}
        />
      </div>

      {state?.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      {!deliveryReady ? (
        <Text variant="muted" className="text-center text-sm">
          {zone === null
            ? 'Choose a delivery option to continue.'
            : 'Choose your location to continue.'}
        </Text>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        isLoading={pending}
        disabled={!deliveryReady}
      >
        Continue to payment
      </Button>
    </form>
  );
}
