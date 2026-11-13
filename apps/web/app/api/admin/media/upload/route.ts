import { NextRequest, NextResponse } from 'next/server';
import { createRepositories, prisma } from '@repo/database';
import { getStorage } from '@/lib/media/storage-driver';
import { guardApi } from '@/lib/auth/api-guard';
import { buildStoredFilename, validateUpload } from '@/lib/media/upload-validation';

export async function POST(req: NextRequest) {
  const guard = await guardApi('media.write');
  if (!guard.ok) return guard.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folderId = formData.get('folderId') as string | null;
    const categoryId = formData.get('categoryId');
    const repos = createRepositories();
    if (folderId && (typeof folderId !== 'string' || !await repos.media.findFolderById(folderId))) {
      return NextResponse.json({ error: 'Choose an existing folder.' }, { status: 400 });
    }
    if (categoryId && (typeof categoryId !== 'string' || !await prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } }))) {
      return NextResponse.json({ error: 'Choose an existing product category.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Validates the actual bytes, not the client-declared Content-Type.
    const validated = await validateUpload(file);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // Generated name — never built from the client's filename, so a crafted
    // name can't escape the upload directory.
    const filename = buildStoredFilename(validated.extension);
    await getStorage().put(filename, validated.buffer, validated.mimeType);

    const media = await repos.media.insert({
      url: `/uploads/${filename}`,
      filename,
      originalFilename: validated.filename,
      mimeType: validated.mimeType,
      extension: validated.extension,
      size: file.size,
      storageKey: filename,
      folderId: folderId || null,
      categoryId: typeof categoryId === 'string' && categoryId ? categoryId : null,
      uploadedBy: guard.userId,
    }).catch(async (error) => {
      await getStorage().remove(filename);
      throw error;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ success: true, media: media as any }, { status: 201 });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
