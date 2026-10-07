import { describe, expect, it } from 'vitest';

import { isBucketUrl, mediaUploadPath, publicAvatarUrl } from './mediaApiPath';

describe('media API paths', () => {
  it('points uploads at the API', () => {
    expect(mediaUploadPath('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      '/v1/media/uploads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('hides a stored R2 avatar URL', () => {
    expect(
      publicAvatarUrl('user-1', 'https://pub-abc.r2.dev/media/avatar/file', 'media/avatar/file'),
    ).toBe('/v1/users/user-1/avatar');
    expect(publicAvatarUrl('user-1', 'https://pub-abc.r2.dev/media/avatar/file', null)).toBeNull();
    expect(publicAvatarUrl('user-1', null, null)).toBeNull();
  });

  it('recognizes bucket hosts', () => {
    expect(isBucketUrl('https://acct.r2.cloudflarestorage.com/bucket/key')).toBe(true);
    expect(isBucketUrl('https://example.test/a.png')).toBe(false);
  });
});
