import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { guardApi } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  const guard = await guardApi('media.read');
  if (!guard.ok) return guard.response;

  const repos = createRepositories();
  const params = req.nextUrl.searchParams;
  const folderId = params.get('folderId') === '__root__' ? null : params.get('folderId') || undefined;
  const categoryId = params.get('categoryId') === '__none__' ? null : params.get('categoryId') || undefined;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(params.get('page')) || 1)));
  // Filtering happens in SQL rather than in the client, so the picker isn't
  // limited to whatever the first page happened to load.
  const search = params.get('search')?.trim() || undefined;

  const { items, total } = await repos.media.adminFindMany({ limit: 60, page, folderId, categoryId, search, imagesOnly: params.get('imagesOnly') === '1' });
  return NextResponse.json({ files: items, total, page, totalPages: Math.max(1, Math.ceil(total / 60)) });
}
