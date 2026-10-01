import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { AuthSessionDto } from '@/shared/contracts/auth.contract';

import type { DeviceInfo } from '../repositories/SessionRepository';

export const QR_LOGIN_STATUSES = ['pending', 'scanned', 'approved', 'denied', 'consumed'] as const;

export type QrLoginStatus = (typeof QR_LOGIN_STATUSES)[number];

/**
 * Server-side QR login challenge. Raw login/poll tokens are never stored —
 * only SHA-256 hashes. The poll token is the session binding (USENIX F1):
 * knowing the QR payload is not enough to steal the resulting session.
 *
 * The session row is created on approve so it appears in the phone's device
 * list immediately; tokens stay on the challenge until the poller claims them.
 */
export type QrLoginChallenge = {
  readonly id: string;
  readonly loginTokenHash: string;
  readonly pollTokenHash: string;
  readonly status: QrLoginStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly requestingDevice: DeviceInfo;
  readonly requestingIpLabel: string;
  readonly scannedByUserId: UserId | null;
  readonly approvedUserId: UserId | null;
  /** Present after approve; cleared once the poller consumes the challenge. */
  readonly issuedSession: AuthSessionDto | null;
};

export type QrLoginChallengePatch = {
  readonly status?: QrLoginStatus;
  readonly scannedByUserId?: UserId | null;
  readonly approvedUserId?: UserId | null;
  readonly issuedSession?: AuthSessionDto | null;
};
