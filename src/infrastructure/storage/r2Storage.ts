import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '@/config/env';
import { InfrastructureError } from '@/shared/errors';

import type { PresignedUpload, StoragePort } from './StoragePort';

const UPLOAD_URL_TTL_SECONDS = 900;

export class R2Storage implements StoragePort {
  readonly enabled: boolean;

  private readonly client: S3Client | null;

  constructor(private readonly config: AppConfig['storage']) {
    this.enabled = config.enabled;
    this.client = config.enabled
      ? new S3Client({
          region: config.region,
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        })
      : null;
  }

  async createUploadUrl(params: {
    readonly key: string;
    readonly contentType: string;
    readonly byteSize: number;
  }): Promise<PresignedUpload> {
    const client = this.requireClient();

    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: params.key,
        ContentType: params.contentType,
        ContentLength: params.byteSize,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { url, expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1_000) };
  }

  publicUrl(key: string): string | null {
    if (this.config.publicUrl.length === 0) {
      return null;
    }

    return `${this.config.publicUrl.replace(/\/$/, '')}/${key}`;
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
