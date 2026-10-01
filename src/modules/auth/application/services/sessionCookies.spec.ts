import { describe, expect, it } from 'vitest';

import {
  ACCESS_COOKIE,
  parseCookieHeader,
  REFRESH_COOKIE,
  serializeClearedSessionCookies,
  serializeCookie,
  serializeSessionCookies,
  shouldExposeTokens,
  toPublicSession,
} from './sessionCookies';

describe('sessionCookies', () => {
  it('ставит httpOnly SameSite=Lax и не светит Secure на http', () => {
    const [access, refresh] = serializeSessionCookies(
      {
        accessToken: 'access.jwt',
        refreshToken: 'refresh.secret',
        expiresAt: '2026-09-27T12:15:00.000Z',
        userId: '11111111-1111-4111-8111-111111111111',
      },
      { secure: false, accessMaxAgeSeconds: 900, refreshMaxAgeSeconds: 2592000 },
    );

    expect(access).toContain(`${ACCESS_COOKIE}=access.jwt`);
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Lax');
    expect(access).toContain('Path=/');
    expect(access).not.toContain('Secure');
    expect(refresh).toContain(`${REFRESH_COOKIE}=refresh.secret`);
    expect(refresh).toContain('Path=/v1/auth');
  });

  it('в production добавляет Secure', () => {
    const cookie = serializeCookie('twilite.access', 'x', {
      path: '/',
      maxAgeSeconds: 60,
      secure: true,
    });

    expect(cookie).toContain('Secure');
  });

  it('прячет токены от web-клиента и оставляет их приложению', () => {
    const session = {
      accessToken: 'access.jwt',
      refreshToken: 'refresh.secret',
      expiresAt: '2026-09-27T12:15:00.000Z',
      userId: '11111111-1111-4111-8111-111111111111',
    };

    expect(shouldExposeTokens('web')).toBe(false);
    expect(toPublicSession(session, false)).toEqual({
      expiresAt: session.expiresAt,
      userId: session.userId,
    });
    expect(shouldExposeTokens('ios')).toBe(true);
    expect(toPublicSession(session, true).accessToken).toBe('access.jwt');
  });

  it('читает cookie header и гасит сессию нулевым Max-Age', () => {
    expect(parseCookieHeader(`${ACCESS_COOKIE}=abc; ${REFRESH_COOKIE}=def`)).toEqual({
      [ACCESS_COOKIE]: 'abc',
      [REFRESH_COOKIE]: 'def',
    });

    for (const cookie of serializeClearedSessionCookies(false)) {
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('HttpOnly');
    }
  });
});
