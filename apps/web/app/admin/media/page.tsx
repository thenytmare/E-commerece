import { createRepositories, prisma } from '@repo/database';
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
  const category = typeof resolved.categoryId === 'string' ? resolved.categoryId : '';
  const folder = typeof resolved.folderId === 'string' ? resolved.folderId : '';
  const page = Math.max(1, Math.min(100000, Math.floor(Number(resolved.page) || 1)));

  const repos = createRepositories();
  const [{ items, total }, stats, folders, categories] = await Promise.all([
    repos.media.adminFindMany({ search, limit: 60, page, categoryId: category === '__none__' ? null : category || undefined, folderId: folder === '__root__' ? null : folder || undefined }),
    repos.media.getStats(),
    repos.media.listAllFolders(),
    prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true, parentId: true }, orderBy: { name: 'asc' } }),
  ]);

  const files = items.map((f) => ({
    id: f.id,
    url: f.url,
    filename: f.originalFilename || f.filename,
    categoryId: f.categoryId,
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
        folders={folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
        categories={categories}
        categoryId={category}
        folderId={folder}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / 60))}
      />
    </AdminPage>
  );
}
