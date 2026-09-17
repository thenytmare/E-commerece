import { auth } from '@/auth';
import { createRepositories } from '@repo/database';
import { Container, Heading, Section, Text } from '@repo/ui';
import { formatDate } from '@/lib/format';
import { StarRating } from './StarRating';
import { ReviewForm } from './ReviewForm';
import { BadgeCheck } from 'lucide-react';

/**
 * Customer reviews for a product: the summary, the approved reviews, and the
 * submission form.
 *
 * Only approved, non-hidden reviews are shown — the repository enforces that,
 * so nothing reaches the storefront before an admin has seen it.
 */
export async function ProductReviews({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  const repos = createRepositories();
  const session = await auth();

  const [summary, reviews, existing] = await Promise.all([
    repos.review.getRatingSummary(productId),
    repos.review.findPublicForProduct(productId),
    session?.user?.id
      ? repos.review.findByProductAndUser(productId, session.user.id)
      : Promise.resolve(null),
  ]);

  return (
    <Section className="border-t border-border">
      <Container>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <Heading as="h2" size="md">
            Customer reviews
          </Heading>
          {summary.count > 0 && summary.average !== null ? (
            <div className="flex items-center gap-2">
              <StarRating value={summary.average} size="md" />
              <Text variant="muted" className="text-sm">
                {summary.average.toFixed(1)} out of 5 · {summary.count} review
                {summary.count === 1 ? '' : 's'}
              </Text>
            </div>
          ) : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <Text variant="muted">
                  No reviews yet — be the first to share what you think.
                </Text>
              </div>
            ) : (
              <ul className="space-y-6">
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-border pb-6 last:border-0">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StarRating value={review.rating} />
                      {review.title ? (
                        <span className="font-medium">{review.title}</span>
                      ) : null}
                      {review.isVerifiedPurchase ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Verified purchase
                        </span>
                      ) : null}
                    </div>

                    {/* Plain interpolation — never dangerouslySetInnerHTML for
                        customer-authored text. */}
                    {review.body ? (
                      <Text className="whitespace-pre-line text-sm">{review.body}</Text>
                    ) : null}

                    <Text variant="muted" className="mt-2 text-xs">
                      {review.user.name || 'Verified customer'} · {formatDate(review.createdAt)}
                    </Text>

                    {review.adminReply ? (
                      <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/40 py-2 pl-4">
                        <Text className="text-xs font-medium">Response from the store</Text>
                        <Text variant="muted" className="mt-1 whitespace-pre-line text-sm">
                          {review.adminReply}
                        </Text>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ReviewForm
            productId={productId}
            productSlug={productSlug}
            isSignedIn={Boolean(session?.user?.id)}
            existingRating={existing?.rating}
            hasExistingReview={Boolean(existing)}
          />
        </div>
      </Container>
    </Section>
  );
}
