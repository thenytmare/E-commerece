import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { Readable } from 'stream';
import { resolveUploadPath, uploadDir } from './storage';

/**
 * Where uploaded files are kept. Local disk is the default. Set
 * STORAGE_DRIVER=s3 to use any S3-compatible bucket (AWS S3, Cloudflare R2,
 * Backblaze B2, MinIO). Files keep the same public URL (/uploads/<name>), so
 * nothing in the database changes when you switch.
 */
export interface StoredFile {
  body: ReadableStream;
  size: number;
  modifiedAt: Date;
}

export interface StorageDriver {
  put(filename: string, data: Buffer, contentType: string): Promise<void>;
  get(filename: string): Promise<StoredFile | null>;
  remove(filename: string): Promise<void>;
}

class LocalDriver implements StorageDriver {
  async put(filename: string, data: Buffer): Promise<void> {
    const full = resolveUploadPath(filename);
    if (!full) throw new Error('Invalid file name.');
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(full, data);
  }

  async get(filename: string): Promise<StoredFile | null> {
    const full = resolveUploadPath(filename);
    if (!full) return null;
    try {
      const info = await stat(full);
      if (!info.isFile()) return null;
      return { body: Readable.toWeb(createReadStream(full)) as ReadableStream, size: info.size, modifiedAt: info.mtime };
    } catch {
      return null;
    }
  }

  async remove(filename: string): Promise<void> {
    const full = resolveUploadPath(filename);
    if (!full) return;
    try {
      await unlink(full);
    } catch {
      // Already gone. Do not block a database delete on this.
    }
  }
}

/** The few S3 calls we use, typed by hand so the package stays optional. */
interface S3Like {
  send(command: unknown): Promise<{ Body?: unknown; ContentLength?: number; LastModified?: Date }>;
}
interface S3Module {
  S3Client: new (config: Record<string, unknown>) => S3Like;
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
}

class S3Driver implements StorageDriver {
  private client: S3Like | null = null;
  private mod: S3Module | null = null;
  private readonly bucket = process.env.S3_BUCKET ?? '';
  private readonly prefix = (process.env.S3_PREFIX ?? 'uploads/').replace(/^\/+/, '');

  private async load(): Promise<{ client: S3Like; mod: S3Module }> {
    if (!this.client || !this.mod) {
      if (!this.bucket) throw new Error('S3_BUCKET is not set.');
      // Optional dependency. Install it only when STORAGE_DRIVER=s3: pnpm add @aws-sdk/client-s3 --filter web
      const name = '@aws-sdk/client-s3';
      this.mod = (await import(/* webpackIgnore: true */ name)) as S3Module;
      this.client = new this.mod.S3Client({
        region: process.env.S3_REGION ?? 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
    }
    return { client: this.client, mod: this.mod };
  }

  private key(filename: string): string {
    if (!filename || filename.startsWith('.') || /[\\/\0]/.test(filename)) throw new Error('Invalid file name.');
    return this.prefix + filename;
  }

  async put(filename: string, data: Buffer, contentType: string): Promise<void> {
    const { client, mod } = await this.load();
    await client.send(new mod.PutObjectCommand({ Bucket: this.bucket, Key: this.key(filename), Body: data, ContentType: contentType }));
  }

  async get(filename: string): Promise<StoredFile | null> {
    try {
      const { client, mod } = await this.load();
      const res = await client.send(new mod.GetObjectCommand({ Bucket: this.bucket, Key: this.key(filename) }));
      const body = res.Body as { transformToWebStream?: () => ReadableStream } | undefined;
      if (!body?.transformToWebStream) return null;
      return { body: body.transformToWebStream(), size: res.ContentLength ?? 0, modifiedAt: res.LastModified ?? new Date() };
    } catch {
      return null;
    }
  }

  async remove(filename: string): Promise<void> {
    try {
      const { client, mod } = await this.load();
      await client.send(new mod.DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(filename) }));
    } catch {
      // Best effort, same as local.
    }
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (!driver) driver = process.env.STORAGE_DRIVER === 's3' ? new S3Driver() : new LocalDriver();
  return driver;
}

/** For tests. */
export function resetStorageForTests(): void {
  driver = null;
}
