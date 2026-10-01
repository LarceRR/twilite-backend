import { DomainError, InfrastructureError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

import { assertHeadWithinLimit } from './boundedGetObject';
import type { PresignedUpload, StorageObjectHead, StoragePort } from './StoragePort';

type StoredObject = {
  readonly bytes: Buffer;
  readonly contentType: string;
};

/** In-memory StoragePort for unit tests (no network). */
export class FakeStorage implements StoragePort {
  readonly enabled = true;
  readonly objects = new Map<string, StoredObject>();

  createUploadUrl(params: {
    readonly key: string;
    readonly contentType: string;
    readonly byteSize: number;
  }): Promise<PresignedUpload> {
    void params.byteSize;
    return Promise.resolve({
      url: `https://upload.example/${params.key}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
  }

  publicUrl(key: string): string | null {
    return `https://cdn.example/${key}`;
  }

  put(key: string, bytes: Buffer, contentType: string): void {
    this.objects.set(key, { bytes, contentType });
  }

  headObject(key: string): Promise<StorageObjectHead | null> {
    const object = this.objects.get(key);
    if (object === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      exists: true,
      contentLength: object.bytes.byteLength,
      contentType: object.contentType,
    });
  }

  async getObject(key: string, options: { readonly maxBytes: number }): Promise<Buffer> {
    const head = await this.headObject(key);
    assertHeadWithinLimit(key, head, options.maxBytes);
    const object = this.objects.get(key);
    if (object === undefined) {
      throw new InfrastructureError('Объект исчез из хранилища', { key });
    }
    if (object.bytes.byteLength > options.maxBytes) {
      throw new DomainError(
        'Объект в хранилище слишком большой',
        { key, maxBytes: options.maxBytes, actual: object.bytes.byteLength },
        { code: ErrorCode.MEDIA_SIZE_MISMATCH },
      );
    }
    return object.bytes;
  }

  putObject(params: {
    readonly key: string;
    readonly body: Buffer;
    readonly contentType: string;
  }): Promise<void> {
    this.put(params.key, params.body, params.contentType);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
}
