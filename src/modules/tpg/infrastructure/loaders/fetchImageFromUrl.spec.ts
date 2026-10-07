import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '@/shared/errors';

import { fetchImageFromUrl } from './fetchImageFromUrl';

describe('fetchImageFromUrl SSRF', () => {
  it('revalidates redirect targets and blocks private hosts', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/secret.png' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchImageFromUrl('https://example.com/a.png', 1024)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('follows a safe redirect then downloads bytes', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.example.com/b.png' },
        }),
      )
      .mockResolvedValueOnce(new Response(png, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const bytes = await fetchImageFromUrl('https://example.com/a.png', 1024);
    expect(bytes.equals(png)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });
});
