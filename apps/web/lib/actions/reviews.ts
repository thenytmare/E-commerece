'use server';

import { z } from 'zod';
import { createRepositories } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { clientIdentifier, rateLimit, retryMessage } from '@/lib/rate-limit';

const repos = createRepositories();

export type ReviewFormState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const reviewSchema = z.object({
  productId: z.string().min(1),
  productSlug: z.string().min(1),
  rating: z.coerce
    .number()
    .int('Choose a star rating')
    .min(1, 'Choose a star rating')
    .max(5, 'Choose a star rating'),
  title: z.string().trim().max(120, 'Keep the title under 120 characters').optional(),
  body: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(4000, 'Keep your review under 4000 characters'),
});

/**
 * Submit (or update) a product review.
 *
 * Reviews land unapproved and are only published once an admin approves them
 * in the moderation queue — which, until this action existed, had nothing to
 * moderate because there was no way for a customer to leave a review at all.
 */
export async function submitReviewAction(
  _prevState: ReviewFormState | null,
  formData: FormData
): Promise<ReviewFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Please sign in to leave a review.' };
  }

  const limit = rateLimit(`review:${await clientIdentifier()}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return { error: retryMessage(limit.retryAfterSeconds) };
  }

  const parsed = reviewSchema.safeParse({
    productId: formData.get('productId'),
    productSlug: formData.get('productSlug'),
    rating: formData.get('rating'),
    title: String(formData.get('title') ?? '').trim() || undefined,
    body: formData.get('body'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  try {
    // Reviewing is open to any signed-in customer, but only a delivered order
    // earns the "Verified purchase" badge.
    const isVerifiedPurchase = await repos.review.hasPurchased(
      parsed.data.productId,
      session.user.id
    );

    await repos.review.submit({
      productId: parsed.data.productId,
      userId: session.user.id,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      isVerifiedPurchase,
    });

    revalidatePath(`/products/${parsed.data.productSlug}`);
    revalidatePath('/admin/reviews');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to submit review:', error);
    return { error: 'Could not save your review just now. Please try again.' };
  }
}
