import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { Brand } from '@/shared/types/Brand';

export type SessionId = Brand<string, 'SessionId'>;

export type DeviceInfo = {
  readonly platform: string;
  readonly model: string | null;
  readonly appVersion: string | null;
};

export type Session = {
  readonly id: SessionId;
  readonly userId: UserId;
  /** Only a hash is stored: a leaked table must not grant access. */
  readonly refreshTokenHash: string;
  readonly device: DeviceInfo;
  /** Masked client address, e.g. `203.0.113.x`. Never a precise IP. */
  readonly ipLabel: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
};

export type CreateSessionInput = {
  readonly userId: UserId;
  readonly refreshTokenHash: string;
  readonly device: DeviceInfo;
  readonly ipLabel: string | null;
  readonly expiresAt: Date;
};

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<Session>;
  findById(id: SessionId): Promise<Session | null>;
  listForUser(userId: UserId): Promise<readonly Session[]>;
  /** Refresh rotation: the old token is invalidated as the new one is issued. */
  rotate(id: SessionId, refreshTokenHash: string, expiresAt: Date): Promise<Session>;
  /**
   * Compare-and-swap rotate used by refresh. Returns null when another request
   * already rotated away `expectedHash` (concurrent refresh / retry).
   */
  rotateIfHashMatches(
    id: SessionId,
    expectedHash: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<Session | null>;
  revoke(id: SessionId): Promise<void>;
  revokeAllForUser(userId: UserId): Promise<void>;
  deleteExpired(before: Date): Promise<number>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
