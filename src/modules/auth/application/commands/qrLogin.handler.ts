import { Inject, Injectable } from '@nestjs/common';

import { type AppLimits, LIMITS } from '@/config/limits';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type {
  DeviceInfoDto,
  QrLoginDecisionResponseDto,
  QrLoginInspectResponseDto,
  QrLoginStartResponseDto,
  QrLoginStatusResponseDto,
} from '@/shared/contracts/auth.contract';
import { AuthenticationError, DomainError, ValidationError } from '@/shared/errors';
import { CLOCK, type Clock } from '@/shared/utils/clock';
import { ID_GENERATOR, type IdGenerator } from '@/shared/utils/id';

import type { QrLoginChallenge } from '../../domain/qrLogin/qrLoginChallenge';
import {
  QR_LOGIN_CHALLENGE_REPOSITORY,
  type QrLoginChallengeRepository,
} from '../../domain/repositories/QrLoginChallengeRepository';
import type { SessionId } from '../../domain/repositories/SessionRepository';
import { hashClientKey, maskIp } from '../../domain/services/maskIp';
import {
  buildQrLoginPayload,
  createQrSecret,
  hashQrSecret,
  parseQrLoginPayload,
  qrSecretsMatch,
} from '../../domain/services/qrLoginTokens';
import { AUTH_RATE_LIMITER, type AuthRateLimiter } from '../services/authRateLimiter';
import { AuthenticateHandler } from './authenticate.handler';

const unknownDevice: DeviceInfoDto = { platform: 'unknown', model: null, appVersion: null };

export type StartQrLoginCommand = {
  readonly device: DeviceInfoDto | null;
  readonly ip: string;
};

export type PollQrLoginCommand = {
  readonly challengeId: string;
  readonly pollToken: string;
};

export type QrTokenCommand = {
  readonly userId: UserId;
  readonly token: string;
};

@Injectable()
export class QrLoginHandler {
  constructor(
    @Inject(QR_LOGIN_CHALLENGE_REPOSITORY) private readonly challenges: QrLoginChallengeRepository,
    @Inject(AUTH_RATE_LIMITER) private readonly rateLimiter: AuthRateLimiter,
    @Inject(LIMITS) private readonly limits: AppLimits,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly authenticate: AuthenticateHandler,
  ) {}

  async start(command: StartQrLoginCommand): Promise<QrLoginStartResponseDto> {
    await this.consumeRate(
      `qr-start:${hashClientKey(command.ip)}`,
      this.limits.auth.qrChallengesPerIpPerHour,
      3600,
    );

    const now = this.clock.now();
    const ttlSeconds = this.limits.auth.qrLoginTtlSeconds;
    const loginToken = createQrSecret();
    const pollToken = createQrSecret();
    const device = command.device ?? unknownDevice;
    const challenge: QrLoginChallenge = {
      id: this.ids.next(),
      loginTokenHash: hashQrSecret(loginToken),
      pollTokenHash: hashQrSecret(pollToken),
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1_000).toISOString(),
      requestingDevice: {
        platform: device.platform,
        model: device.model ?? null,
        appVersion: device.appVersion ?? null,
      },
      requestingIpLabel: maskIp(command.ip),
      scannedByUserId: null,
      approvedUserId: null,
      issuedSession: null,
    };

    await this.challenges.create(challenge, ttlSeconds);

    return {
      challengeId: challenge.id,
      qrPayload: buildQrLoginPayload(loginToken),
      pollToken,
      expiresAt: challenge.expiresAt,
      expiresInSeconds: ttlSeconds,
    };
  }

  async poll(command: PollQrLoginCommand): Promise<QrLoginStatusResponseDto> {
    await this.consumeRate(
      `qr-poll:${command.challengeId}`,
      this.limits.auth.qrPollsPerChallengePerMinute,
      60,
    );

    const challenge = await this.challenges.findById(command.challengeId);

    // Missing, expired, consumed, or unbound poller all look the same.
    // That closes Authorization Hijacking / Double Login (USENIX F1, F2).
    if (challenge === null || this.isExpired(challenge) || challenge.status === 'consumed') {
      return { status: 'expired' };
    }

    if (!qrSecretsMatch(challenge.pollTokenHash, command.pollToken)) {
      return { status: 'expired' };
    }

    if (challenge.status === 'pending') {
      return { status: 'pending' };
    }

    if (challenge.status === 'scanned') {
      return { status: 'scanned' };
    }

    if (challenge.status === 'denied') {
      return { status: 'denied' };
    }

    if (challenge.status !== 'approved') {
      return { status: 'expired' };
    }

    // Approve won the race but session mint has not landed on the challenge yet.
    if (challenge.issuedSession === null) {
      return { status: 'scanned' };
    }

    const claimed = await this.challenges.transition(challenge.id, ['approved'], {
      status: 'consumed',
      issuedSession: null,
    });

    if (claimed === null) {
      return { status: 'expired' };
    }

    // Tokens were minted on approve; only the poll-token holder receives them.
    return { status: 'approved', session: challenge.issuedSession };
  }

  async inspect(command: QrTokenCommand): Promise<QrLoginInspectResponseDto> {
    const challenge = await this.loadByLoginToken(command.token);
    this.assertUsable(challenge);

    if (challenge.status === 'pending') {
      const scanned = await this.challenges.transition(challenge.id, ['pending'], {
        status: 'scanned',
        scannedByUserId: command.userId,
      });

      if (scanned === null) {
        const latest = await this.challenges.findById(challenge.id);
        this.assertOwnedBy(latest, command.userId);
        return this.toInspect(latest ?? challenge);
      }

      return this.toInspect(scanned);
    }

    this.assertOwnedBy(challenge, command.userId);

    return this.toInspect(challenge);
  }

  async approve(command: QrTokenCommand): Promise<QrLoginDecisionResponseDto> {
    await this.consumeRate(
      `qr-approve:${command.userId}`,
      this.limits.auth.qrApprovalsPerUserPerHour,
      3600,
    );

    const challenge = await this.loadByLoginToken(command.token);
    this.assertUsable(challenge);
    this.assertOwnedBy(
      challenge.status === 'pending' ? { ...challenge, scannedByUserId: null } : challenge,
      command.userId,
    );

    if (challenge.status === 'approved' || challenge.status === 'consumed') {
      throw alreadyUsed();
    }

    if (challenge.status === 'denied') {
      throw alreadyUsed();
    }

    // Mint the session now so the approving phone sees it under Devices
    // immediately. Tokens stay on the challenge until the browser polls.
    const session = await this.authenticate.issueSession(
      command.userId,
      toDeviceDto(challenge.requestingDevice),
      challenge.requestingIpLabel,
    );

    const approved = await this.challenges.transition(challenge.id, ['pending', 'scanned'], {
      status: 'approved',
      scannedByUserId: challenge.scannedByUserId ?? command.userId,
      approvedUserId: command.userId,
      issuedSession: session,
    });

    if (approved === null) {
      // Another phone won the race. Drop the session we just minted so it
      // does not linger in the device list.
      const refreshToken = session.refreshToken;
      if (typeof refreshToken === 'string') {
        const separator = refreshToken.indexOf('.');
        if (separator > 0) {
          await this.authenticate.signOut(refreshToken.slice(0, separator) as SessionId);
        }
      }
      throw alreadyUsed();
    }

    return { status: 'approved' };
  }

  async deny(command: QrTokenCommand): Promise<QrLoginDecisionResponseDto> {
    const challenge = await this.loadByLoginToken(command.token);
    this.assertUsable(challenge);
    this.assertOwnedBy(
      challenge.status === 'pending' ? { ...challenge, scannedByUserId: null } : challenge,
      command.userId,
    );

    if (
      challenge.status === 'approved' ||
      challenge.status === 'consumed' ||
      challenge.status === 'denied'
    ) {
      throw alreadyUsed();
    }

    const denied = await this.challenges.transition(challenge.id, ['pending', 'scanned'], {
      status: 'denied',
      scannedByUserId: challenge.scannedByUserId ?? command.userId,
    });

    if (denied === null) {
      throw alreadyUsed();
    }

    return { status: 'denied' };
  }

  private async loadByLoginToken(raw: string): Promise<QrLoginChallenge> {
    const token = parseQrLoginPayload(raw);

    if (token === null) {
      throw invalidToken();
    }

    const challenge = await this.challenges.findByLoginTokenHash(hashQrSecret(token));

    if (challenge === null) {
      throw invalidToken();
    }

    return challenge;
  }

  private assertUsable(challenge: QrLoginChallenge): void {
    if (this.isExpired(challenge)) {
      throw expiredToken();
    }

    if (challenge.status === 'consumed' || challenge.status === 'approved') {
      throw alreadyUsed();
    }
  }

  private assertOwnedBy(challenge: QrLoginChallenge | null, userId: UserId): void {
    if (challenge === null) {
      throw invalidToken();
    }

    if (
      challenge.status === 'approved' ||
      challenge.status === 'consumed' ||
      challenge.status === 'denied'
    ) {
      throw alreadyUsed();
    }

    if (challenge.scannedByUserId !== null && challenge.scannedByUserId !== userId) {
      throw alreadyUsed();
    }
  }

  private isExpired(challenge: QrLoginChallenge): boolean {
    return Date.parse(challenge.expiresAt) <= this.clock.now().getTime();
  }

  private toInspect(challenge: QrLoginChallenge): QrLoginInspectResponseDto {
    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      requestingDevice: {
        platform: toPlatform(challenge.requestingDevice.platform),
        model: challenge.requestingDevice.model,
        appVersion: challenge.requestingDevice.appVersion,
        ipLabel: challenge.requestingIpLabel,
      },
    };
  }

  private async consumeRate(key: string, limit: number, windowSeconds: number): Promise<void> {
    const allowed = await this.rateLimiter.consume(key, limit, windowSeconds);

    if (!allowed) {
      throw new ValidationError('Слишком много попыток', [
        { path: 'rate', message: `limit ${limit} / ${windowSeconds}s` },
      ]);
    }
  }
}

function toDeviceDto(device: QrLoginChallenge['requestingDevice']): DeviceInfoDto {
  return {
    platform: toPlatform(device.platform),
    model: device.model,
    appVersion: device.appVersion,
  };
}

function toPlatform(value: string): DeviceInfoDto['platform'] {
  return value === 'ios' || value === 'android' || value === 'web' ? value : 'unknown';
}

function invalidToken(): AuthenticationError {
  return new AuthenticationError('Токен входа недействителен');
}

function expiredToken(): DomainError {
  return new DomainError('Токен входа истёк');
}

function alreadyUsed(): DomainError {
  return new DomainError('Токен входа уже использован');
}
