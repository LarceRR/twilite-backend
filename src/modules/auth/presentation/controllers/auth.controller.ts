import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import {
  SESSION_REPOSITORY,
  type SessionId,
  type SessionRepository,
} from '@/modules/auth/domain/repositories/SessionRepository';
import { maskIp } from '@/modules/auth/domain/services/maskIp';
import { toUserId } from '@/modules/users/domain/value-objects/UserId';
import type {
  AuthSessionDto,
  QrLoginDecisionResponseDto,
  QrLoginInspectResponseDto,
  QrLoginStartResponseDto,
  QrLoginStatusResponseDto,
  SessionDto,
} from '@/shared/contracts/auth.contract';
import { type AuthenticatedUser, CurrentUser, Public } from '@/shared/decorators/auth.decorators';
import { AuthenticationError, NotFoundError } from '@/shared/errors';

import { AuthenticateHandler } from '../../application/commands/authenticate.handler';
import { QrLoginHandler } from '../../application/commands/qrLogin.handler';
import { RefreshSessionHandler } from '../../application/commands/refreshSession.handler';
import {
  attachSessionCookies,
  clearSessionCookies,
  cookieWriteOptions,
  readRefreshToken,
  shouldExposeTokens,
  toPublicSession,
} from '../../application/services/sessionCookies';
import {
  AuthSessionResponseDto,
  QrLoginDecisionResponseDto as QrLoginDecisionSwaggerDto,
  QrLoginInspectResponseDto as QrLoginInspectSwaggerDto,
  QrLoginStartDto,
  QrLoginStartResponseDto as QrLoginStartSwaggerDto,
  QrLoginStatusDto,
  QrLoginStatusResponseDto as QrLoginStatusSwaggerDto,
  QrLoginTokenDto,
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
    private readonly qrLogin: QrLoginHandler,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Создать аккаунт и личное пространство' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async signUp(
    @Body() body: SignUpDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionDto> {
    const session = await this.authenticate.signUp({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      device: body.device ?? null,
      ipLabel: maskIp(request.ip),
    });

    return this.deliverSession(reply, session, body.device?.platform);
  }

  @Public()
  @Post('sign-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Войти по почте и паролю' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async signIn(
    @Body() body: SignInDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionDto> {
    const session = await this.authenticate.signIn({
      email: body.email,
      password: body.password,
      device: body.device ?? null,
      ipLabel: maskIp(request.ip),
    });

    return this.deliverSession(reply, session, body.device?.platform);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Обновить пару токенов (ротация refresh-токена)' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionDto> {
    const refreshToken = readRefreshToken(request, body.refreshToken);

    if (refreshToken === null) {
      throw new AuthenticationError('Отсутствует refresh-токен');
    }

    const session = await this.refreshHandler.execute(refreshToken);
    const fromCookie = body.refreshToken === undefined;

    return this.deliverSession(reply, session, fromCookie ? 'web' : 'ios');
  }

  @Post('sign-out')
  @HttpCode(204)
  @ApiOperation({ summary: 'Завершить текущую сессию' })
  async signOut(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.authenticate.signOut(user.sessionId as SessionId);
    clearSessionCookies(reply, this.config.app.isProduction);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Активные устройства пользователя' })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  async listSessions(@CurrentUser() user: AuthenticatedUser): Promise<readonly SessionDto[]> {
    const sessions = await this.sessions.listForUser(user.userId);
    const now = Date.now();

    return sessions
      .filter((session) => session.expiresAt.getTime() > now)
      .map((session) => ({
        id: session.id,
        device: {
          platform: toPlatform(session.device.platform),
          model: session.device.model,
          appVersion: session.device.appVersion,
        },
        ipLabel: session.ipLabel,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        current: session.id === user.sessionId,
      }));
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Завершить выбранную сессию' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const session = await this.sessions.findById(sessionId as SessionId);

    if (session === null || session.userId !== user.userId || session.revokedAt !== null) {
      throw new NotFoundError('Сессия не найдена');
    }

    await this.sessions.revoke(session.id);

    if (session.id === user.sessionId) {
      clearSessionCookies(reply, this.config.app.isProduction);
    }
  }

  @Delete('sessions')
  @HttpCode(204)
  @ApiOperation({ summary: 'Выйти на всех устройствах' })
  async revokeAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.sessions.revokeAllForUser(user.userId);
    clearSessionCookies(reply, this.config.app.isProduction);
  }

  @Public()
  @Post('qr/challenges')
  @HttpCode(200)
  @ApiOperation({ summary: 'Создать QR-вызов входа (токен в QR, poll-секрет только браузеру)' })
  @ApiOkResponse({ type: QrLoginStartSwaggerDto })
  async startQrLogin(
    @Body() body: QrLoginStartDto,
    @Req() request: FastifyRequest,
  ): Promise<QrLoginStartResponseDto> {
    return this.qrLogin.start({
      device: body.device ?? readRequestDevice(request),
      ip: request.ip,
    });
  }

  @Public()
  @Post('qr/challenges/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Статус QR-входа. Сессия выдаётся только владельцу poll-токена' })
  @ApiOkResponse({ type: QrLoginStatusSwaggerDto })
  async pollQrLogin(
    @Body() body: QrLoginStatusDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<QrLoginStatusResponseDto> {
    const result = await this.qrLogin.poll({
      challengeId: body.challengeId,
      pollToken: body.pollToken,
    });

    if (result.status !== 'approved' || result.session === undefined) {
      return result;
    }

    return {
      status: 'approved',
      session: this.deliverSession(reply, result.session as Required<AuthSessionDto>, 'web'),
    };
  }

  @Post('qr/challenges/inspect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Телефон: разобрать QR и показать устройство, которое входит' })
  @ApiOkResponse({ type: QrLoginInspectSwaggerDto })
  async inspectQrLogin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: QrLoginTokenDto,
  ): Promise<QrLoginInspectResponseDto> {
    return this.qrLogin.inspect({
      userId: toUserId(user.userId),
      token: body.token,
    });
  }

  @Post('qr/challenges/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Телефон: подтвердить вход на устройство из QR' })
  @ApiOkResponse({ type: QrLoginDecisionSwaggerDto })
  async approveQrLogin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: QrLoginTokenDto,
  ): Promise<QrLoginDecisionResponseDto> {
    return this.qrLogin.approve({
      userId: toUserId(user.userId),
      token: body.token,
    });
  }

  @Post('qr/challenges/deny')
  @HttpCode(200)
  @ApiOperation({ summary: 'Телефон: отклонить вход по QR' })
  @ApiOkResponse({ type: QrLoginDecisionSwaggerDto })
  async denyQrLogin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: QrLoginTokenDto,
  ): Promise<QrLoginDecisionResponseDto> {
    return this.qrLogin.deny({
      userId: toUserId(user.userId),
      token: body.token,
    });
  }

  private deliverSession(
    reply: FastifyReply,
    session: AuthSessionDto,
    platform: 'ios' | 'android' | 'web' | 'unknown' | undefined,
  ): AuthSessionDto {
    if (session.accessToken !== undefined && session.refreshToken !== undefined) {
      attachSessionCookies(reply, session, cookieWriteOptions(this.config));
    }

    return toPublicSession(session, shouldExposeTokens(platform));
  }
}

function readRequestDevice(request: FastifyRequest): { platform: 'web'; model: string | null; appVersion: string | null } {
  const header = request.headers['user-agent'];
  const userAgent = typeof header === 'string' ? header.slice(0, 120) : null;

  return { platform: 'web', model: userAgent, appVersion: 'tpg-web' };
}

function toPlatform(value: string): 'ios' | 'android' | 'web' | 'unknown' {
  return value === 'ios' || value === 'android' || value === 'web' ? value : 'unknown';
}
