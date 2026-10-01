export const STORAGE = Symbol('STORAGE');

export type PresignedUpload = {
  readonly url: string;
  readonly expiresAt: Date;
};

export type StorageObjectHead = {
  readonly contentLength: number;
  readonly contentType: string | null;
  readonly exists: true;
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
  /**
   * Metadata-only probe. Must not download object bytes.
   * Returns null when the key is missing.
   */
  headObject(key: string): Promise<StorageObjectHead | null>;
  /**
   * Read object bytes with a hard size cap (P1-S3).
   * HEAD first; never downloads when contentLength exceeds maxBytes.
   */
  getObject(key: string, options: { readonly maxBytes: number }): Promise<Buffer>;
  /** Server-side write used for generated previews (P2-S11). */
  putObject(params: {
    readonly key: string;
    readonly body: Buffer;
    readonly contentType: string;
  }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Default for content addressed by UUID path — safe for Cloudflare edge cache. */
export const IMMUTABLE_OBJECT_CACHE_CONTROL = 'public, max-age=31536000, immutable';
