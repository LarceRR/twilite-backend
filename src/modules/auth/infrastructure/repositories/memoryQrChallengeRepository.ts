import type { QrLoginChallenge, QrLoginChallengePatch } from '../../domain/qrLogin/qrLoginChallenge';
import type { QrLoginStatus } from '../../domain/qrLogin/qrLoginChallenge';
import type { QrLoginChallengeRepository } from '../../domain/repositories/QrLoginChallengeRepository';

/** Deterministic store for unit tests. TTL is enforced by `expiresAt` in the handler. */
export class MemoryQrChallengeRepository implements QrLoginChallengeRepository {
  private readonly byId = new Map<string, QrLoginChallenge>();
  private readonly byLoginHash = new Map<string, string>();

  async create(challenge: QrLoginChallenge, _ttlSeconds: number): Promise<void> {
    this.byId.set(challenge.id, challenge);
    this.byLoginHash.set(challenge.loginTokenHash, challenge.id);
  }

  async findById(id: string): Promise<QrLoginChallenge | null> {
    return this.byId.get(id) ?? null;
  }

  async findByLoginTokenHash(loginTokenHash: string): Promise<QrLoginChallenge | null> {
    const id = this.byLoginHash.get(loginTokenHash);

    return id === undefined ? null : this.findById(id);
  }

  async transition(
    id: string,
    allowed: readonly QrLoginStatus[],
    patch: QrLoginChallengePatch,
  ): Promise<QrLoginChallenge | null> {
    const current = this.byId.get(id);

    if (current === undefined || !allowed.includes(current.status)) {
      return null;
    }

    const next: QrLoginChallenge = {
      ...current,
      ...patch,
    };

    this.byId.set(id, next);

    return next;
  }
}
