import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@/shared/errors/AppError';

import { FakeStorage } from './fakeStorage';

describe('FakeStorage headObject', () => {
  it('returns null for a missing key', async () => {
    const storage = new FakeStorage();
    await expect(storage.headObject('missing')).resolves.toBeNull();
  });

  it('returns exact byte length and content type', async () => {
    const storage = new FakeStorage();
    storage.put('a/b.png', Buffer.from([1, 2, 3, 4]), 'image/png');

    await expect(storage.headObject('a/b.png')).resolves.toEqual({
      exists: true,
      contentLength: 4,
      contentType: 'image/png',
    });
  });
});

describe('FakeStorage getObject (P1-S3)', () => {
  it('returns bytes when within maxBytes', async () => {
    const storage = new FakeStorage();
    storage.put('sheet.png', Buffer.from([1, 2, 3]), 'image/png');
    await expect(storage.getObject('sheet.png', { maxBytes: 3 })).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
  });

  it('rejects before download when HEAD exceeds maxBytes', async () => {
    const storage = new FakeStorage();
    storage.put('big.png', Buffer.alloc(10), 'image/png');
    await expect(storage.getObject('big.png', { maxBytes: 4 })).rejects.toMatchObject({
      code: ErrorCode.MEDIA_SIZE_MISMATCH,
    });
  });

  it('rejects missing objects with MEDIA_OBJECT_MISSING', async () => {
    const storage = new FakeStorage();
    await expect(storage.getObject('gone.png', { maxBytes: 100 })).rejects.toMatchObject({
      code: ErrorCode.MEDIA_OBJECT_MISSING,
    });
  });
});
