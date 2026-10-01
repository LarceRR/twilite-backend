import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '@/config/env';
import { InfrastructureError } from '@/shared/errors';

import { assertHeadWithinLimit, readBodyWithByteLimit } from './boundedGetObject';
import {
  IMMUTABLE_OBJECT_CACHE_CONTROL,
  type PresignedUpload,
  type StorageObjectHead,
  type StoragePort,
} from './StoragePort';

const UPLOAD_URL_TTL_SECONDS = 900;

/**
 * R2 + browser PUT: AWS SDK ≥3.729 injects CRC32 into PutObject by default.
 * That checksum is computed over an empty presign body (`AAAAAA==`) and baked
 * into the URL — browsers uploading real bytes then fail (CORS/"Failed to fetch"
 * or 403). Cloudflare documents disabling it via WHEN_REQUIRED.
 *
 * @see https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
 */
export class R2Storage implements StoragePort {
  readonly enabled: boolean;

  private readonly client: S3Client | null;

  constructor(private readonly config: AppConfig['storage']) {
    this.enabled = config.enabled;
    this.client = config.enabled
      ? new S3Client({
          region: config.region,
          endpoint: config.endpoint,
          // Path-style URLs (`https://<account>.r2.cloudflarestorage.com/<bucket>/…`)
          // match browser CSP `https://*.r2.cloudflarestorage.com` (one DNS label).
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        })
      : null;
  }

  async createUploadUrl(params: {
    readonly key: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly cacheControl?: string;
  }): Promise<PresignedUpload> {
    const client = this.requireClient();
    const cacheControl = params.cacheControl ?? IMMUTABLE_OBJECT_CACHE_CONTROL;

    // Omit ContentLength from the command: signing it is brittle for browser
    // fetch. Content-Type + Cache-Control must be signed so the client sends
    // the same values (params.byteSize is still validated at ticket creation).
    void params.byteSize;

    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: params.key,
        ContentType: params.contentType,
        CacheControl: cacheControl,
      }),
      {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        signableHeaders: new Set(['content-type', 'cache-control']),
      },
    );

    return { url, expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1_000) };
  }

  publicUrl(key: string): string | null {
    if (this.config.publicUrl.length === 0) {
      return null;
    }

    return `${this.config.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  async headObject(key: string): Promise<StorageObjectHead | null> {
    const client = this.requireClient();
    try {
      const response = await client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return {
        exists: true,
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType ?? null,
      };
    } catch (error) {
      if (isNotFoundStorageError(error)) {
        return null;
      }
      throw new InfrastructureError('Не удалось проверить файл в хранилище', { key }, error);
    }
  }

  async getObject(key: string, options: { readonly maxBytes: number }): Promise<Buffer> {
    const head = await this.headObject(key);
    assertHeadWithinLimit(key, head, options.maxBytes);

    const client = this.requireClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (response.Body === undefined) {
      throw new InfrastructureError('Пустой файл в хранилище', { key });
    }
    const bytes = await readBodyWithByteLimit(response.Body, options.maxBytes, key);
    return bytes;
  }

  async putObject(params: {
    readonly key: string;
    readonly body: Buffer;
    readonly contentType: string;
  }): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        CacheControl: IMMUTABLE_OBJECT_CACHE_CONTROL,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  private requireClient(): S3Client {
    if (this.client === null) {
      throw new InfrastructureError('Хранилище файлов не настроено');
    }

    return this.client;
  }
}

function isNotFoundStorageError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  const status =
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata
      ? Number(error.$metadata.httpStatusCode)
      : undefined;
  return name === 'NotFound' || name === 'NoSuchKey' || status === 404;
}
