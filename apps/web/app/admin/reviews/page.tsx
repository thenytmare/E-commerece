import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { ReviewListClient } from './ReviewListClient';

export const metadata = { title: 'Reviews | Admin' };

export default async function ReviewsPage() {
  await requirePermission('reviews.read');
  const repos = createRepositories();
  // isPinned and adminReply used to be hardcoded here, so a pinned review or
  // an existing store reply never showed in the moderation queue.
  const reviews = (await repos.review.findMany()).items.map((r) => ({
    id: r.id,
    productName: r.product.name,
    productSlug: r.product.slug,
    customerName: r.user.name ?? r.user.email,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isApproved: r.isApproved,
    isPinned: r.isPinned,
    adminReply: r.adminReply,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <AdminPage title="Reviews" description="Moderate product reviews and ratings.">
      <ReviewListClient initialData={reviews} />
    </AdminPage>
  );
}