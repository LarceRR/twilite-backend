import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

import { AuthenticateHandler } from './application/commands/authenticate.handler';
import { RefreshSessionHandler } from './application/commands/refreshSession.handler';
import { PasswordService } from './application/services/password.service';
import { TokenService } from './application/services/token.service';
import { SESSION_REPOSITORY } from './domain/repositories/SessionRepository';
import { DrizzleSessionRepository } from './infrastructure/repositories/drizzleSessionRepository';
import { AuthController } from './presentation/controllers/auth.controller';

@Module({
  // Secrets are passed per call from APP_CONFIG, so the module needs no options.
  imports: [JwtModule.register({}), UsersModule, SpacesModule],
  controllers: [AuthController],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: DrizzleSessionRepository },
    PasswordService,
    TokenService,
    AuthenticateHandler,
    RefreshSessionHandler,
  ],
  // TokenService is exported for the global auth guard and the realtime gateway.
  exports: [TokenService, SESSION_REPOSITORY],
})
export class AuthModule {}
