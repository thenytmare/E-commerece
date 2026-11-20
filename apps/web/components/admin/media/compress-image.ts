/**
 * Phone cameras take big photos (often 5 to 15 MB). The upload limit is 10 MB
 * and mobile data is slow, so a large JPEG is made smaller in the browser
 * before it is sent. 2000 pixels on the long side is plenty for a product page.
 *
 * Only JPEG is changed. PNG and WebP can have see-through areas that a JPEG
 * would turn black, and small files are not worth the work. If anything goes
 * wrong, or the result is not smaller, the original file is sent as it is.
 */
export const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
export const MAX_SIDE_PX = 2000;
const QUALITY = 0.85;

export async function shrinkImage(file: File): Promise<File> {
  if (file.type !== 'image/jpeg' || file.size <= SHRINK_ABOVE_BYTES) return file;
  if (typeof createImageBitmap !== 'function') return file;

  try {
    // 'from-image' applies the phone's rotation, so a portrait photo stays upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
