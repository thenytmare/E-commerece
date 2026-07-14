'use client';

import { addToCartAction, type CartActionState } from '@/lib/actions/cart';
import { Button } from '@repo/ui';
import { useActionState } from 'react';

const initialState: CartActionState = {};

interface AddToCartButtonProps {
  variantId: string;
  disabled?: boolean;
}

export function AddToCartButton({ variantId, disabled }: AddToCartButtonProps) {
  const [state, action, pending] = useActionState(addToCartAction, initialState);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="variantId" value={variantId} />
        <input type="hidden" name="quantity" value="1" />
        <Button type="submit" className="w-full sm:w-auto" isLoading={pending} disabled={disabled}>
          {state?.success ? 'Added to cart' : 'Add to cart'}
        </Button>
      </form>
      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
