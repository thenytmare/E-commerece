import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { AdminPage } from '@/components/admin/ui/AdminPage';
import { MediaListClient } from './MediaListClient';

export const metadata = { title: 'Media Library | Admin' };

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Defence in depth: don't rely on middleware alone for this route.
  await requirePermission('media.read');

  const resolved = await searchParams;
  const search = typeof resolved.search === 'string' ? resolved.search : undefined;

  const repos = createRepositories();
  const [{ items, total }, stats, folders] = await Promise.all([
    repos.media.adminFindMany({ search, limit: 100 }),
    repos.media.getStats(),
    repos.media.listFolders(null),
  ]);

  const files = items.map((f) => ({
    id: f.id,
    url: f.url,
    filename: f.filename,
    mimeType: f.mimeType,
    size: f.size,
    alt: f.alt ?? '',
    createdAt: f.createdAt.toISOString(),
  }));

  return (
    <AdminPage
      title="Media Library"
      description={`${total} file${total === 1 ? '' : 's'} · ${(stats.totalSize / 1024 / 1024).toFixed(1)} MB total`}
    >
      <MediaListClient
        initialData={files}
        initialSearch={search ?? ''}
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      />
    </AdminPage>
  );
}
