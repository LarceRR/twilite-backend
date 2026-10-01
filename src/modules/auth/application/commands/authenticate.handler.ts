import { Inject, Injectable } from '@nestjs/common';

import { CreateSpaceHandler } from '@/modules/spaces/application/commands/createSpace.handler';
import {
  SPACE_REPOSITORY,
  type SpaceRepository,
} from '@/modules/spaces/domain/repositories/SpaceRepository';
import { UserRbacService } from '@/modules/rbac/application/services/rbacAdmin.services';
import type { User } from '@/modules/users/domain/entities/User';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/modules/users/domain/repositories/UserRepository';
import { toEmail } from '@/modules/users/domain/value-objects/Email';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { type AppLimits, LIMITS } from '@/config/limits';
import type { AuthSessionDto, DeviceInfoDto } from '@/shared/contracts/auth.contract';
import { AuthenticationError, ConflictError } from '@/shared/errors';

import {
  SESSION_REPOSITORY,
  type SessionId,
  type SessionRepository,
} from '../../domain/repositories/SessionRepository';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';

export type SignUpCommand = {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly device: DeviceInfoDto | null;
  readonly ipLabel: string | null;
};

export type SignInCommand = {
  readonly email: string;
  readonly password: string;
  readonly device: DeviceInfoDto | null;
  readonly ipLabel: string | null;
};

const unknownDevice: DeviceInfoDto = { platform: 'unknown', model: null, appVersion: null };

@Injectable()
export class AuthenticateHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly createSpace: CreateSpaceHandler,
    private readonly userRbac: UserRbacService,
    @Inject(LIMITS) private readonly limits: AppLimits,
  ) {}

  /**
   * Signing up also creates the Personal space: the app is unusable without one,
   * so it is part of the same operation rather than a later lazy fix-up.
   */
  async signUp(command: SignUpCommand): Promise<AuthSessionDto> {
    const email = toEmail(command.email);

    if ((await this.users.findByEmail(email)) !== null) {
      throw new ConflictError('Аккаунт с такой почтой уже существует');
    }

    const passwordHash = await this.passwords.hash(command.password);
    const user = await this.users.create({
      email,
      displayName: command.displayName.trim(),
      passwordHash,
    });

    await this.userRbac.assignDefaultGroup(user.id);
    await this.ensurePersonalSpace(user);

    return this.issueSession(user.id, command.device, command.ipLabel);
  }

  async signIn(command: SignInCommand): Promise<AuthSessionDto> {
    const email = toEmail(command.email);
    const credentials = await this.users.findCredentialsByEmail(email);

    if (credentials === null) {
      // Same message as a wrong password: do not reveal which accounts exist.
      throw new AuthenticationError('Неверная почта или пароль');
    }

    await this.passwords.verify(command.password, credentials.passwordHash);

    const user = await this.users.findById(credentials.userId);

    if (user === null) {
      throw new AuthenticationError('Неверная почта или пароль');
    }

    await this.ensurePersonalSpace(user);
    await this.userRbac.ensureDefaultGroup(user.id);

    return this.issueSession(user.id, command.device, command.ipLabel);
  }

  async signOut(sessionId: SessionId): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  private async ensurePersonalSpace(user: User): Promise<void> {
    if ((await this.spaces.findPersonalSpace(user.id)) !== null) {
      return;
    }

    await this.createSpace.execute({
      ownerId: user.id,
      title: 'Личное пространство',
      type: 'Personal',
    });
  }

  async issueSession(
    userId: UserId,
    device: DeviceInfoDto | null,
    ipLabel: string | null = null,
  ): Promise<AuthSessionDto> {
    const resolvedDevice = device ?? unknownDevice;
    await this.enforceSessionCap(userId);

    // The refresh token embeds the session id, so the row is created first with a
    // placeholder hash and immediately rotated to the real one.
    const session = await this.sessions.create({
      userId,
      refreshTokenHash: 'pending',
      device: {
        platform: resolvedDevice.platform,
        model: resolvedDevice.model ?? null,
        appVersion: resolvedDevice.appVersion ?? null,
      },
      ipLabel,
      expiresAt: this.tokens.refreshExpiry(),
    });

    const refreshToken = this.tokens.createRefreshToken(session.id);
    await this.sessions.rotate(
      session.id,
      this.tokens.hashRefreshToken(refreshToken),
      session.expiresAt,
    );

    const access = await this.tokens.issueAccessToken({ userId, sessionId: session.id });

    return {
      accessToken: access.token,
      refreshToken,
      expiresAt: access.expiresAt.toISOString(),
      userId,
    };
  }

  private async enforceSessionCap(userId: UserId): Promise<void> {
    const active = await this.sessions.listForUser(userId);
    const overflow = active.length - this.limits.auth.activeSessionsPerUser + 1;

    if (overflow <= 0) {
      return;
    }

    const oldest = [...active].sort((left, right) => left.lastUsedAt.getTime() - right.lastUsedAt.getTime());

    for (const session of oldest.slice(0, overflow)) {
      await this.sessions.revoke(session.id);
    }
  }
}
