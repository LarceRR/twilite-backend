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
    /** Object cache policy; UUID keys use long immutable TTL for CDN. */
    readonly cacheControl?: string;
  }): Promise<PresignedUpload>;
  publicUrl(key: string): string | null;
  /** Read an object the API itself stored. Used to validate uploads before publish. */
  getObject(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Default for content addressed by UUID path — safe for Cloudflare edge cache. */
export const IMMUTABLE_OBJECT_CACHE_CONTROL = 'public, max-age=31536000, immutable';
