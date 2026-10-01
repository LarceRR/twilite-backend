import { InfrastructureError, ValidationError } from '@/shared/errors';

import { assertHttpImageUrl } from '../../domain/services/assertHttpImageUrl';

/** Downloads image bytes from a public URL. Nothing is written to disk. */
export async function fetchImageFromUrl(rawUrl: string, maxBytes: number): Promise<Buffer> {
  const url = assertHttpImageUrl(rawUrl);

  let response: Response;

  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/*' },
    });
  } catch (origin) {
    throw new InfrastructureError('Не удалось скачать изображение по URL', {}, origin);
  }

  if (!response.ok) {
    throw new ValidationError('Источник изображения недоступен', [
      { path: 'imageUrl', message: `HTTP ${response.status}` },
    ]);
  }

  return readBodyWithLimit(response, maxBytes);
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
