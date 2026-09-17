import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { guardApi } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  const guard = await guardApi('media.read');
  if (!guard.ok) return guard.response;

  const repos = createRepositories();
  const params = req.nextUrl.searchParams;
  const folderId = params.get('folderId') || null;
  // Filtering happens in SQL rather than in the client, so the picker isn't
  // limited to whatever the first page happened to load.
  const search = params.get('search')?.trim() || undefined;

  const { items } = await repos.media.adminFindMany({ limit: 500, folderId, search });
  return NextResponse.json({ files: items });
}
