import { DomainError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

import type { StorageObjectHead } from './StoragePort';

export function assertHeadWithinLimit(
  key: string,
  head: StorageObjectHead | null,
  maxBytes: number,
): asserts head is StorageObjectHead {
  if (head === null) {
    throw new DomainError(
      'Объект в хранилище не найден',
      { key },
      { code: ErrorCode.MEDIA_OBJECT_MISSING },
    );
  }
  if (head.contentLength > maxBytes) {
    throw new DomainError(
      'Объект в хранилище слишком большой',
      { key, maxBytes, actual: head.contentLength },
      { code: ErrorCode.MEDIA_SIZE_MISMATCH },
    );
  }
}

/** Accumulate a stream and abort if more than maxBytes arrive (defense vs lying HEAD). */
export async function readBodyWithByteLimit(
  body: {
    transformToByteArray?: () => Promise<Uint8Array>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
  },
  maxBytes: number,
  key: string,
): Promise<Buffer> {
  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        throw new DomainError(
          'Объект в хранилище слишком большой',
          { key, maxBytes, actual: total },
          { code: ErrorCode.MEDIA_SIZE_MISMATCH },
        );
      }
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (typeof body.transformToByteArray === 'function') {
    const bytes = Buffer.from(await body.transformToByteArray());
    if (bytes.byteLength > maxBytes) {
      throw new DomainError(
        'Объект в хранилище слишком большой',
        { key, maxBytes, actual: bytes.byteLength },
        { code: ErrorCode.MEDIA_SIZE_MISMATCH },
      );
    }
    return bytes;
  }

  throw new DomainError(
    'Не удалось прочитать объект из хранилища',
    { key },
    { code: ErrorCode.STORAGE_UNAVAILABLE },
  );
}
