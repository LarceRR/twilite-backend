import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '@/config/env';
import { InfrastructureError } from '@/shared/errors';

import {
  IMMUTABLE_OBJECT_CACHE_CONTROL,
  type PresignedUpload,
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

  async getObject(key: string): Promise<Buffer> {
    const client = this.requireClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (response.Body === undefined) {
      throw new InfrastructureError('Пустой файл в хранилище');
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
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
