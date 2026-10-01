import type {
  QrLoginChallenge,
  QrLoginChallengePatch,
  QrLoginStatus,
} from '../qrLogin/qrLoginChallenge';

export interface QrLoginChallengeRepository {
  create(challenge: QrLoginChallenge, ttlSeconds: number): Promise<void>;
  findById(id: string): Promise<QrLoginChallenge | null>;
  findByLoginTokenHash(loginTokenHash: string): Promise<QrLoginChallenge | null>;
  /**
   * Atomically apply `patch` only if the current status is one of `allowed`.
   * Returns the updated challenge, or null if the row is gone / status mismatch.
   */
  transition(
    id: string,
    allowed: readonly QrLoginStatus[],
    patch: QrLoginChallengePatch,
  ): Promise<QrLoginChallenge | null>;
}

export const QR_LOGIN_CHALLENGE_REPOSITORY = Symbol('QR_LOGIN_CHALLENGE_REPOSITORY');
