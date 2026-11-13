import { beforeEach, describe, expect, it, vi } from 'vitest';
const guardApi = vi.fn();
const insert = vi.fn();
const findFolderById = vi.fn();
const category = vi.fn();
const put = vi.fn();
const remove = vi.fn();
vi.mock('@/lib/auth/api-guard', () => ({ guardApi }));
vi.mock('@repo/database', () => ({ createRepositories: () => ({ media: { insert, findFolderById } }), prisma: { category: { findFirst: category } } }));
vi.mock('@/lib/media/storage-driver', () => ({ getStorage: () => ({ put, remove }) }));
vi.mock('@/lib/media/upload-validation', () => ({ buildStoredFilename: () => 'safe.png', validateUpload: async () => ({ ok: true, filename: 'original.png', extension: 'png', mimeType: 'image/png', buffer: Buffer.from('image') }) }));
const { POST } = await import('@/app/api/admin/media/upload/route');
function request(categoryId = 'cat') {
  const body = new FormData(); body.set('file', new File(['image'], 'original.png', { type: 'image/png' })); body.set('categoryId', categoryId);
  return { formData: async () => body };
}
beforeEach(() => { vi.clearAllMocks(); guardApi.mockResolvedValue({ ok: true, userId: 'admin' }); category.mockResolvedValue({ id: 'cat' }); insert.mockResolvedValue({ id: 'media' }); });
describe('category uploads', () => {
  it('stores the selected category and original filename', async () => {
    expect((await POST(request())).status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat', originalFilename: 'original.png', uploadedBy: 'admin' }));
  });
  it('rejects a deleted or invalid category before writing files', async () => {
    category.mockResolvedValue(null);
    expect((await POST(request('gone'))).status).toBe(400);
    expect(put).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled();
  });
  it('removes an uploaded file when its database insert fails', async () => {
    insert.mockRejectedValueOnce(new Error('db unavailable'));
    expect((await POST(request())).status).toBe(500);
    expect(remove).toHaveBeenCalledWith('safe.png');
  });
  it('enforces media.write before processing the upload', async () => {
    guardApi.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(guardApi).toHaveBeenCalledWith('media.write'); expect(put).not.toHaveBeenCalled();
  });
});
