import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { guardApi } from '@/lib/auth/api-guard';
import { buildStoredFilename, validateUpload } from '@/lib/media/upload-validation';

export async function POST(req: NextRequest) {
  const guard = await guardApi('media.write');
  if (!guard.ok) return guard.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folderId = formData.get('folderId') as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Validates the actual bytes, not the client-declared Content-Type.
    const validated = await validateUpload(file);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Generated name — never built from the client's filename, so a crafted
    // name can't escape the upload directory.
    const filename = buildStoredFilename(validated.extension);
    await writeFile(path.join(uploadDir, filename), validated.buffer);

    const repos = createRepositories();
    const media = await repos.media.insert({
      url: `/uploads/${filename}`,
      filename,
      originalFilename: validated.filename,
      mimeType: validated.mimeType,
      extension: validated.extension,
      size: file.size,
      storageKey: filename,
      folderId: folderId || null,
      uploadedBy: guard.userId,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ success: true, media: media as any }, { status: 201 });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
