export const STORAGE = Symbol('STORAGE');

export type PresignedUpload = {
  readonly url: string;
  readonly expiresAt: Date;
};

/**
 * A port so media does not depend on a specific object store. R2 today, anything
 * S3-compatible tomorrow.
 */
export interface StoragePort {
  readonly enabled: boolean;
  createUploadUrl(params: {
    readonly key: string;
    readonly contentType: string;
    readonly byteSize: number;
  }): Promise<PresignedUpload>;
  publicUrl(key: string): string | null;
  delete(key: string): Promise<void>;
}
