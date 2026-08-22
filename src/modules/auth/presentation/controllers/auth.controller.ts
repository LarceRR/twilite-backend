import { Body, Controller, Delete, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SESSION_REPOSITORY,
  type SessionId,
  type SessionRepository,
} from '@/modules/auth/domain/repositories/SessionRepository';
import type { AuthSessionDto, SessionDto } from '@/shared/contracts/auth.contract';
import { type AuthenticatedUser, CurrentUser, Public } from '@/shared/decorators/auth.decorators';

import { AuthenticateHandler } from '../../application/commands/authenticate.handler';
import { RefreshSessionHandler } from '../../application/commands/refreshSession.handler';
import {
  AuthSessionResponseDto,
  RefreshDto,
  SessionResponseDto,
  SignInDto,
  SignUpDto,
} from '../dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticate: AuthenticateHandler,
    private readonly refreshHandler: RefreshSessionHandler,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Создать аккаунт и личное пространство' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async signUp(@Body() body: SignUpDto): Promise<AuthSessionDto> {
    return this.authenticate.signUp({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      device: body.device ?? null,
    });
  }

  @Public()
  @Post('sign-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Войти по почте и паролю' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async signIn(@Body() body: SignInDto): Promise<AuthSessionDto> {
    return this.authenticate.signIn({
      email: body.email,
      password: body.password,
      device: body.device ?? null,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Обновить пару токенов (ротация refresh-токена)' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async refresh(@Body() body: RefreshDto): Promise<AuthSessionDto> {
    return this.refreshHandler.execute(body.refreshToken);
  }

  @Post('sign-out')
  @HttpCode(204)
  @ApiOperation({ summary: 'Завершить текущую сессию' })
  async signOut(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authenticate.signOut(user.sessionId as SessionId);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Активные устройства пользователя' })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  async listSessions(@CurrentUser() user: AuthenticatedUser): Promise<readonly SessionDto[]> {
    const sessions = await this.sessions.listForUser(user.userId);

    return sessions.map((session) => ({
      id: session.id,
      device: {
        platform: toPlatform(session.device.platform),
        model: session.device.model,
        appVersion: session.device.appVersion,
      },
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === user.sessionId,
    }));
  }

  @Delete('sessions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Выйти на всех устройствах' })
  async revokeAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.sessions.revokeAllForUser(user.userId);
  }
}

function toPlatform(value: string): 'ios' | 'android' | 'web' | 'unknown' {
  return value === 'ios' || value === 'android' || value === 'web' ? value : 'unknown';
}
