import { InfrastructureError, ValidationError } from '@/shared/errors';

import { assertHttpImageUrl } from '../../domain/services/assertHttpImageUrl';

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

/** Downloads image bytes from a public URL. Nothing is written to disk. */
export async function fetchImageFromUrl(rawUrl: string, maxBytes: number): Promise<Buffer> {
  let current = assertHttpImageUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchOnce(current);

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (location === null || location.length === 0) {
        throw new ValidationError('Источник изображения недоступен', [
          { path: 'imageUrl', message: 'Redirect без Location' },
        ]);
      }
      if (hop === MAX_REDIRECTS) {
        throw new ValidationError('Источник изображения недоступен', [
          { path: 'imageUrl', message: 'Слишком много redirect' },
        ]);
      }
      current = assertHttpImageUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new ValidationError('Источник изображения недоступен', [
        { path: 'imageUrl', message: `HTTP ${response.status}` },
      ]);
    }

    return readBodyWithLimit(response, maxBytes);
  }

  throw new ValidationError('Источник изображения недоступен', [
    { path: 'imageUrl', message: 'Слишком много redirect' },
  ]);
}

async function fetchOnce(url: URL): Promise<Response> {
  try {
    return await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });
  } catch (origin) {
    throw new InfrastructureError('Не удалось скачать изображение по URL', {}, origin);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);

  if (contentLength > maxBytes) {
    throw new ValidationError('Изображение слишком большое', [
      { path: 'imageUrl', message: `Максимум ${maxBytes} байт` },
    ]);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.byteLength > maxBytes) {
    throw new ValidationError('Изображение слишком большое', [
      { path: 'imageUrl', message: `Максимум ${maxBytes} байт` },
    ]);
  }

  return bytes;
}
