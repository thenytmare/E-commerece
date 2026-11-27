import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('local storage driver', () => {
  it('writes, reads and removes a file, and refuses bad names', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
    process.env.UPLOAD_DIR = dir;
    delete process.env.STORAGE_DRIVER;
    vi.resetModules();
    const { getStorage } = await import('@/lib/media/storage-driver');
    const storage = getStorage();

    await storage.put('a.png', Buffer.from('hello'), 'image/png');
    const file = await storage.get('a.png');
    expect(file?.size).toBe(5);

    expect(await storage.get('../a.png')).toBeNull();
    await expect(storage.put('../evil.png', Buffer.from('x'), 'image/png')).rejects.toThrow();

    await storage.remove('a.png');
    expect(await storage.get('a.png')).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('startup checks', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const base = () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.AUTH_SECRET = 'x'.repeat(40);
  };

  it('starts a single production instance without the Server Action key', async () => {
    base();
    process.env.NODE_ENV = 'production';
    delete process.env.APP_INSTANCES;
    delete process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
    vi.resetModules();
    const { validateEnv } = await import('@/lib/env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('refuses to start several production instances without the Server Action key', async () => {
    base();
    process.env.NODE_ENV = 'production';
    process.env.APP_INSTANCES = '2';
    delete process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;
    vi.resetModules();
    const { validateEnv } = await import('@/lib/env');
    expect(() => validateEnv()).toThrow(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/);
  });

  it('starts several instances when the key is set', async () => {
    base();
    process.env.NODE_ENV = 'production';
    process.env.APP_INSTANCES = '2';
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = 'k'.repeat(44);
    vi.resetModules();
    const { validateEnv } = await import('@/lib/env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('needs a bucket when S3 storage is chosen', async () => {
    base();
    process.env.NODE_ENV = 'development';
    process.env.STORAGE_DRIVER = 's3';
    delete process.env.S3_BUCKET;
    vi.resetModules();
    const { validateEnv } = await import('@/lib/env');
    expect(() => validateEnv()).toThrow(/S3_BUCKET/);
  });
});
