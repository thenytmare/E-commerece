'use client';

import { useState, useTransition } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toggleWishlistAction } from '@/lib/actions/wishlist';

/**
 * Save / unsave a product.
 *
 * Optimistic, but rolls back if the server rejects — and prompts a guest to
 * sign in rather than silently doing nothing.
 */
export function WishlistButton({
  productId,
  productSlug,
  variantId,
  initialSaved,
  className = '',
  showLabel = false,
}: {
  productId: string;
  productSlug: string;
  variantId?: string | null;
  initialSaved: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    const previous = saved;
    setSaved(!previous);
    setMessage(null);

    startTransition(async () => {
      const result = await toggleWishlistAction(productId, variantId);

      if (result.requiresSignIn) {
        setSaved(previous);
        router.push(`/login?callbackUrl=/products/${productSlug}`);
        return;
      }

      if (!result.success) {
        setSaved(previous);
        setMessage(result.error ?? 'Could not update your saved items.');
        return;
      }

      setSaved(Boolean(result.saved));
    });
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from saved items' : 'Save for later'}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Heart
            className={`h-4 w-4 ${saved ? 'fill-destructive text-destructive' : ''}`}
            aria-hidden="true"
          />
        )}
        {showLabel ? <span>{saved ? 'Saved' : 'Save for later'}</span> : null}
      </button>

      {message ? (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
