import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RbacModule } from '@/modules/rbac/rbac.module';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

import { AuthenticateHandler } from './application/commands/authenticate.handler';
import { QrLoginHandler } from './application/commands/qrLogin.handler';
import { RefreshSessionHandler } from './application/commands/refreshSession.handler';
import { AUTH_RATE_LIMITER } from './application/services/authRateLimiter';
import { PasswordService } from './application/services/password.service';
import { TokenService } from './application/services/token.service';
import { QR_LOGIN_CHALLENGE_REPOSITORY } from './domain/repositories/QrLoginChallengeRepository';
import { SESSION_REPOSITORY } from './domain/repositories/SessionRepository';
import { RedisAuthRateLimiter } from './infrastructure/rateLimit/redisAuthRateLimiter';
import { DrizzleSessionRepository } from './infrastructure/repositories/drizzleSessionRepository';
import { RedisQrChallengeRepository } from './infrastructure/repositories/redisQrChallengeRepository';
import { AuthController } from './presentation/controllers/auth.controller';

@Module({
  imports: [JwtModule.register({}), UsersModule, SpacesModule, RbacModule],
  controllers: [AuthController],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: DrizzleSessionRepository },
    { provide: QR_LOGIN_CHALLENGE_REPOSITORY, useClass: RedisQrChallengeRepository },
    { provide: AUTH_RATE_LIMITER, useClass: RedisAuthRateLimiter },
    PasswordService,
    TokenService,
    AuthenticateHandler,
    RefreshSessionHandler,
    QrLoginHandler,
  ],
  exports: [TokenService, SESSION_REPOSITORY],
})
export class AuthModule {}
