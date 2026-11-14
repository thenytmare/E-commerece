'use client';

import { useActionState, useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Input, Text } from '@repo/ui';
import Link from 'next/link';
import { submitReviewAction, type ReviewFormState } from '@/lib/actions/reviews';

const initialState: ReviewFormState = {};

export function ReviewForm({
  productId,
  productSlug,
  isSignedIn,
  existingRating,
  hasExistingReview,
}: {
  productId: string;
  productSlug: string;
  isSignedIn: boolean;
  existingRating?: number;
  hasExistingReview: boolean;
}) {
  const [state, action, pending] = useActionState(submitReviewAction, initialState);
  const [rating, setRating] = useState(existingRating ?? 0);
  const [hovered, setHovered] = useState(0);

  if (!isSignedIn) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
        <Text variant="muted" className="mb-3 text-sm">
          Sign in to write a review for this product.
        </Text>
        <Button asChild size="sm" variant="outline">
          <Link href={`/login?callbackUrl=/products/${productSlug}`}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (state.success) {
    return (
      <div
        className="rounded-xl border border-success/40 bg-success/10 p-6 text-center"
        role="status"
      >
        <Text className="font-medium">Thanks for your review</Text>
        <Text variant="muted" className="mt-1 text-sm">
          It will appear on this page once our team has checked it.
        </Text>
      </div>
    );
  }

  const displayRating = hovered || rating;

  return (
    <form action={action} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <Text className="mb-1 font-semibold">
          {hasExistingReview ? 'Update your review' : 'Write a review'}
        </Text>
        {hasExistingReview ? (
          <Text variant="muted" className="text-sm">
            Saving again replaces your existing review and sends it back for checking.
          </Text>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              // Radio semantics so the whole control is reachable and
              // announced properly, rather than five nameless buttons.
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              onMouseEnter={() => setHovered(star)}
              onFocus={() => setHovered(star)}
              onBlur={() => setHovered(0)}
              onClick={() => setRating(star)}
              disabled={pending}
              className="rounded p-0.5"
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  star <= displayRating
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-muted-foreground/40'
                }`}
              />
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating ? (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {state.fieldErrors.rating}
          </p>
        ) : null}
      </fieldset>

      <Input
        name="title"
        label="Title (optional)"
        placeholder="Sums up your experience"
        disabled={pending}
        error={state.fieldErrors?.title}
      />

      <div className="space-y-1.5">
        <label htmlFor="review-body" className="block text-sm font-medium">
          Your review
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={4}
          required
          disabled={pending}
          placeholder="What did you like or dislike? How did you use it?"
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          aria-describedby={state.fieldErrors?.body ? 'review-body-error' : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {state.fieldErrors?.body ? (
          <p id="review-body-error" className="text-sm text-destructive" role="alert">
            {state.fieldErrors.body}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" isLoading={pending} disabled={rating === 0}>
        {hasExistingReview ? 'Update review' : 'Submit review'}
      </Button>
    </form>
  );
}
