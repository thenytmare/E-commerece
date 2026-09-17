/**
 * Content validation for admin media uploads.
 *
 * Uploaded files land in `public/uploads` and are served back from this app's
 * own origin, so anything a browser parses as markup (`.html`, `.svg`,
 * `.xhtml`) becomes stored XSS against whoever opens it. Two rules follow:
 *
 *  1. The allow-list below is exhaustive, and deliberately contains no
 *     scriptable format.
 *  2. `file.type` is supplied by the uploading client and is trivially
 *     spoofed, so it is never trusted. Binary formats are confirmed by their
 *     magic bytes before anything is written to disk.
 */

/** One offset/bytes pair that must match for a signature to apply. */
interface SignaturePart {
  offset: number;
  bytes: number[];
}

interface FileTypeRule {
  extensions: string[];
  mimeType: string;
  /**
   * Alternative signatures — the file matches when every part of any one
   * alternative matches. An empty list marks a format with no reliable magic
   * bytes (plain text), which is checked by `looksLikeMarkup` instead.
   */
  signatures: SignaturePart[][];
  /** True for formats stored as human-readable text rather than binary. */
  isText?: boolean;
}

const ascii = (value: string): number[] => [...value].map((char) => char.charCodeAt(0));

const FILE_TYPE_RULES: FileTypeRule[] = [
  {
    extensions: ['jpg', 'jpeg'],
    mimeType: 'image/jpeg',
    signatures: [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  },
  {
    extensions: ['png'],
    mimeType: 'image/png',
    signatures: [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  },
  {
    extensions: ['gif'],
    mimeType: 'image/gif',
    signatures: [[{ offset: 0, bytes: ascii('GIF87a') }], [{ offset: 0, bytes: ascii('GIF89a') }]],
  },
  {
    extensions: ['webp'],
    mimeType: 'image/webp',
    // RIFF container with a WEBP fourcc at byte 8.
    signatures: [[{ offset: 0, bytes: ascii('RIFF') }, { offset: 8, bytes: ascii('WEBP') }]],
  },
  {
    extensions: ['avif'],
    mimeType: 'image/avif',
    signatures: [[{ offset: 4, bytes: ascii('ftypavif') }]],
  },
  {
    extensions: ['pdf'],
    mimeType: 'application/pdf',
    signatures: [[{ offset: 0, bytes: ascii('%PDF-') }]],
  },
  {
    extensions: ['zip'],
    mimeType: 'application/zip',
    signatures: [
      [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
      [{ offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }],
      [{ offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] }],
    ],
  },
  {
    extensions: ['docx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signatures: [[{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }]],
  },
  {
    extensions: ['xlsx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signatures: [[{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }]],
  },
  {
    extensions: ['csv'],
    mimeType: 'text/csv',
    signatures: [],
    isText: true,
  },
  {
    extensions: ['txt'],
    mimeType: 'text/plain',
    signatures: [],
    isText: true,
  },
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_EXTENSIONS = FILE_TYPE_RULES.flatMap((rule) => rule.extensions);

export type UploadValidationResult =
  | { ok: true; extension: string; mimeType: string; filename: string; buffer: Buffer }
  | { ok: false; error: string };

function matchesSignature(buffer: Buffer, parts: SignaturePart[]): boolean {
  return parts.every((part) =>
    part.bytes.every((byte, index) => buffer[part.offset + index] === byte)
  );
}

/**
 * Reject text files that a content-sniffing browser could still treat as
 * markup. `.csv`/`.txt` have no magic bytes to check, so this is the only
 * thing standing between "a spreadsheet export" and "an HTML page with a
 * .txt extension".
 */
function looksLikeMarkup(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  return (
    head.startsWith('<') ||
    head.includes('<script') ||
    head.includes('<svg') ||
    head.includes('<!doctype html') ||
    head.includes('<html')
  );
}

/**
 * Strip the client-supplied name down to something safe to echo back in the
 * UI. The name written to disk is generated separately and never derived from
 * this, so path traversal has nowhere to land.
 */
export function sanitizeOriginalFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'file';
}

/** Storage name: random, lowercase, and always ending in a vetted extension. */
export function buildStoredFilename(extension: string): string {
  const random = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${random}.${extension}`;
}

/**
 * Validate an uploaded file by its actual bytes.
 *
 * The extension is taken from the client's filename but only ever used to
 * look up a rule in the allow-list — an unknown extension is rejected outright
 * rather than passed through, so `.html` and `.svg` never reach the disk.
 */
export async function validateUpload(file: File): Promise<UploadValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: 'That file is empty.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That file is larger than the 10MB limit.' };
  }

  const original = sanitizeOriginalFilename(file.name);
  const extension = original.includes('.') ? original.split('.').pop()!.toLowerCase() : '';

  const rule = FILE_TYPE_RULES.find((candidate) => candidate.extensions.includes(extension));
  if (!rule) {
    return {
      ok: false,
      error: `Files of type "${extension || 'unknown'}" can't be uploaded. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (rule.isText) {
    if (looksLikeMarkup(buffer)) {
      return { ok: false, error: 'That file contains markup and can’t be uploaded as text.' };
    }
  } else if (!rule.signatures.some((alternative) => matchesSignature(buffer, alternative))) {
    return {
      ok: false,
      error: `That file doesn’t look like a real .${extension} file. Check the file and try again.`,
    };
  }

  return {
    ok: true,
    extension,
    mimeType: rule.mimeType,
    filename: original,
    buffer,
  };
}
