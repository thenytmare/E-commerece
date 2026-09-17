import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { guardApi } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  const guard = await guardApi('media.read');
  if (!guard.ok) return guard.response;

  const repos = createRepositories();
  const parentId = req.nextUrl.searchParams.get('parentId') || null;

  const folders = await repos.media.listFolders(parentId);
  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi('media.write');
  if (!guard.ok) return guard.response;

  try {
    const { name, parentId } = await req.json();
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      return NextResponse.json({ error: 'Enter a folder name.' }, { status: 400 });
    }

    const repos = createRepositories();
    const folder = await repos.media.createFolder(trimmed, parentId || null);
    return NextResponse.json({ folder });
  } catch {
    return NextResponse.json({ error: 'Failed to create folder.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardApi('media.delete');
  if (!guard.ok) return guard.response;

  try {
    const { id } = await req.json();
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'No folder specified.' }, { status: 400 });
    }

    const repos = createRepositories();
    await repos.media.deleteFolder(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete folder.' }, { status: 500 });
  }
}
