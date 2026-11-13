import { NextResponse } from 'next/server';
import { mimeTypeForExtension } from '@/lib/media/upload-validation';
import { getStorage } from '@/lib/media/storage-driver';

// Serves admin uploads from the storage driver (local disk by default), so files added while the app is
// running are available immediately (and to the image optimiser, which
// fetches /uploads/... over HTTP).
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (segments.length !== 1) return new NextResponse('Not found', { status: 404 });

  const filename = decodeURIComponent(segments[0] ?? '');
  const mimeType = mimeTypeForExtension(filename.split('.').pop() ?? '');
  if (!filename || !mimeType) return new NextResponse('Not found', { status: 404 });

  const file = await getStorage().get(filename);
  if (!file) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(file.body, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(file.size),
      // File names are unique (timestamp + random), so they can be cached for a month.
      'Cache-Control': 'public, max-age=2592000',
      'Last-Modified': file.modifiedAt.toUTCString(),
      // The extra security headers for /uploads are added by next.config.ts.
    },
  });
}
