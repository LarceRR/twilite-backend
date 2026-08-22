import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '@/config/env';
import type { SessionId } from '@/modules/auth/domain/repositories/SessionRepository';
import { toUserId, type UserId } from '@/modules/users/domain/value-objects/UserId';
import { AuthenticationError } from '@/shared/errors';
export type AccessTokenPayload = { readonly userId: UserId; readonly sessionId: SessionId };
type RawAccessPayload = { sub?: unknown; sid?: unknown };
const REFRESH_TOKEN_BYTES = 48;
@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}
  async issueAccessToken(payload: AccessTokenPayload): Promise<{ token: string; expiresAt: Date }> {
    const token = await this.jwt.signAsync(
      { sub: payload.userId, sid: payload.sessionId },
      { secret: this.config.auth.accessSecret, expiresIn: this.config.auth.accessTtlSeconds },
    );
    return { token, expiresAt: new Date(Date.now() + this.config.auth.accessTtlSeconds * 1_000) };
  }
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RawAccessPayload>(token, {
        secret: this.config.auth.accessSecret,
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
        throw new AuthenticationError('Некорректный токен доступа');
      return { userId: toUserId(payload.sub), sessionId: payload.sid as SessionId };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError('Токен доступа недействителен или истёк', {}, error);
    }
  }
  createRefreshToken(sessionId: SessionId): string {
    return `${sessionId}.${randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')}`;
  }
  parseRefreshToken(token: string): { sessionId: SessionId; hash: string } {
    const separator = token.indexOf('.');
    if (separator <= 0) throw new AuthenticationError('Некорректный refresh-токен');
    return {
      sessionId: token.slice(0, separator) as SessionId,
      hash: this.hashRefreshToken(token),
    };
  }
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  refreshExpiry(): Date {
    return new Date(Date.now() + this.config.auth.refreshTtlSeconds * 1_000);
  }
}
