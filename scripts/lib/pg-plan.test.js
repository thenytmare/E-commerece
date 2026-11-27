import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const plan = require('./pg-plan.js');

const local = { user: 'prime', password: 's3cret', host: 'localhost', port: '5432', database: 'prime' };
const remote = { user: 'prime', password: 's3cret', host: 'db.example.com', port: '5432', database: 'prime' };
const scratchSameName = { ...remote, host: '10.0.0.5' };

describe('planRestore', () => {
  it('uses local pg_restore with an explicit host and port, and keeps the password off the command line', () => {
    const p = plan.planRestore(remote, 'x.dump', { hasPgRestore: true });
    expect(p.mode).toBe('local');
    expect(p.args).toContain('-h');
    expect(p.args[p.args.indexOf('-h') + 1]).toBe('db.example.com');
    expect(p.args[p.args.indexOf('-p') + 1]).toBe('5432');
    expect(p.args.join(' ')).not.toContain('s3cret');
    expect(p.env.PGPASSWORD).toBe('s3cret');
  });

  it('uses the docker fallback only for the local compose database', () => {
    const p = plan.planRestore(local, 'x.dump', { hasPgRestore: false });
    expect(p.mode).toBe('docker');
    expect(p.args.join(' ')).not.toContain('s3cret');
  });

  it('refuses the docker fallback for a remote target that shares the local database name', () => {
    for (const target of [remote, scratchSameName]) {
      const p = plan.planRestore(target, 'x.dump', { hasPgRestore: false });
      expect(p.mode).toBe('refuse');
    }
  });

  it('refuses docker when the local port is not the compose port', () => {
    const p = plan.planRestore({ ...local, port: '6543' }, 'x.dump', { hasPgRestore: false, composePort: '5432' });
    expect(p.mode).toBe('refuse');
  });
});

describe('planDump', () => {
  it('names the host and port for local pg_dump, and refuses docker for a remote host', () => {
    const p = plan.planDump(remote, 'out.dump', { hasPgDump: true });
    expect(p.args[p.args.indexOf('-h') + 1]).toBe('db.example.com');
    expect(p.args.join(' ')).not.toContain('s3cret');
    expect(plan.planDump(remote, 'out.dump', { hasPgDump: false }).mode).toBe('refuse');
    expect(plan.planDump(local, 'out.dump', { hasPgDump: false }).mode).toBe('docker');
  });
});

describe('uploads and target text', () => {
  it('finds the upload folder and the matching archive name', () => {
    const uploadDir = path.resolve('/data/uploads');
    expect(plan.resolveUploadDir('/repo', { UPLOAD_DIR: uploadDir })).toBe(uploadDir);
    expect(plan.resolveUploadDir('/repo', {})).toMatch(/apps.web.public.uploads$/);
    expect(plan.uploadsArchiveFor('backups/prime-1.dump')).toBe('backups/prime-1-uploads.tar.gz');
  });

  it('describes the target without the password', () => {
    expect(plan.describeTarget(remote)).not.toContain('s3cret');
    expect(plan.describeTarget(remote)).toContain('db.example.com:5432');
  });
});
