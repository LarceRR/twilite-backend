import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AppConfig } from '@/config/env';
import type { AuthSessionDto, DeviceInfoDto } from '@/shared/contracts/auth.contract';

export const ACCESS_COOKIE = 'twilite.access';
export const REFRESH_COOKIE = 'twilite.refresh';

const ACCESS_PATH = '/';
const REFRESH_PATH = '/v1/auth';

export type CookieWriteOptions = {
  readonly secure: boolean;
  readonly accessMaxAgeSeconds: number;
  readonly refreshMaxAgeSeconds: number;
};

export function cookieWriteOptions(config: AppConfig): CookieWriteOptions {
  return {
    secure: config.app.isProduction,
    accessMaxAgeSeconds: config.auth.accessTtlSeconds,
    refreshMaxAgeSeconds: config.auth.refreshTtlSeconds,
  };
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (header === undefined || header.length === 0) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (name.length === 0) {
      continue;
    }

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

export function readCookie(request: FastifyRequest, name: string): string | null {
  const value = parseCookieHeader(headerValue(request.headers.cookie))[name];
  return value === undefined || value.length === 0 ? null : value;
}

export function readAccessToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();

    if (token.length > 0) {
      return token;
    }
  }

  return readCookie(request, ACCESS_COOKIE);
}

export function readRefreshToken(
  request: FastifyRequest,
  bodyToken: string | undefined,
): string | null {
  if (typeof bodyToken === 'string' && bodyToken.length > 0) {
    return bodyToken;
  }

  return readCookie(request, REFRESH_COOKIE);
}

export function serializeSessionCookies(
  session: AuthSessionDto,
  options: CookieWriteOptions,
): readonly string[] {
  return [
    serializeCookie(ACCESS_COOKIE, session.accessToken ?? '', {
      path: ACCESS_PATH,
      maxAgeSeconds: options.accessMaxAgeSeconds,
      secure: options.secure,
    }),
    serializeCookie(REFRESH_COOKIE, session.refreshToken ?? '', {
      path: REFRESH_PATH,
      maxAgeSeconds: options.refreshMaxAgeSeconds,
      secure: options.secure,
    }),
  ];
}

export function serializeClearedSessionCookies(secure: boolean): readonly string[] {
  return [
    serializeCookie(ACCESS_COOKIE, '', { path: ACCESS_PATH, maxAgeSeconds: 0, secure }),
    serializeCookie(REFRESH_COOKIE, '', { path: REFRESH_PATH, maxAgeSeconds: 0, secure }),
  ];
}

export function appendSetCookies(reply: FastifyReply, cookies: readonly string[]): void {
  // Fastify appends Set-Cookie on each call; passing an array can be collapsed
  // by some proxies into one comma-joined header that browsers only partly apply.
  for (const cookie of cookies) {
    reply.header('Set-Cookie', cookie);
  }
}

export function attachSessionCookies(
  reply: FastifyReply,
  session: AuthSessionDto,
  options: CookieWriteOptions,
): void {
  appendSetCookies(reply, serializeSessionCookies(session, options));
}

export function clearSessionCookies(reply: FastifyReply, secure: boolean): void {
  appendSetCookies(reply, serializeClearedSessionCookies(secure));
}

export function shouldExposeTokens(platform: DeviceInfoDto['platform'] | undefined): boolean {
  return platform === 'ios' || platform === 'android';
}

export function toPublicSession(session: AuthSessionDto, exposeTokens: boolean): AuthSessionDto {
  if (exposeTokens) {
    return session;
  }

  return {
    expiresAt: session.expiresAt,
    userId: session.userId,
  };
}

export function serializeCookie(
  name: string,
  value: string,
  options: { path: string; maxAgeSeconds: number; secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${Math.max(0, options.maxAgeSeconds)}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.join('; ');
  }

  return value;
}
