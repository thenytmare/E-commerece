import path from 'path';

/**
 * Where uploaded files live on disk.
 *
 * Set UPLOAD_DIR to a persistent folder outside the app (for example a Docker
 * volume mounted at /data/uploads). When it is not set, files go to
 * public/uploads, which is where earlier uploads already are.
 *
 * Files are served by app/uploads/[...path]/route.ts, so a file uploaded
 * while the app is running shows up at once. Next.js itself only serves
 * files that were in public/ when it started.
 */
export function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), 'public', 'uploads');
}

/**
 * Absolute path for a stored file name, or null if the name could point
 * outside the upload folder (path separators, "..", hidden files, empty).
 */
export function resolveUploadPath(filename: string): string | null {
  if (!filename || filename.startsWith('.') || /[\\/\0]/.test(filename)) return null;
  const dir = uploadDir();
  const full = path.join(dir, filename);
  return path.dirname(full) === dir ? full : null;
}
