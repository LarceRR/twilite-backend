import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const QR_LOGIN_SCHEME = 'twilite';
export const QR_LOGIN_PATH = 'login';
export const QR_LOGIN_VERSION = '1';
export const QR_LOGIN_TOKEN_BYTES = 32;
/** Non-URI wire format so OS cameras do not treat the QR as a hijackable deep link. */
export const QR_LOGIN_WIRE_PREFIX = `twilite.login.v${QR_LOGIN_VERSION}.`;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function createQrSecret(): string {
  return randomBytes(QR_LOGIN_TOKEN_BYTES).toString('base64url');
}

export function hashQrSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function qrSecretsMatch(storedHash: string, providedSecret: string): boolean {
  return hashesEqual(storedHash, hashQrSecret(providedSecret));
}

export function hashesEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildQrLoginPayload(loginToken: string): string {
  return `${QR_LOGIN_WIRE_PREFIX}${loginToken}`;
}

/**
 * Accepts the in-app wire format (`twilite.login.v1.<token>`), a raw token,
 * or the legacy deep link. Foreign schemes are rejected.
 */
export function parseQrLoginPayload(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > 256) {
    return null;
  }

  if (trimmed.startsWith(QR_LOGIN_WIRE_PREFIX)) {
    return decodeLoginToken(trimmed.slice(QR_LOGIN_WIRE_PREFIX.length));
  }

  if (!trimmed.includes('://')) {
    return decodeLoginToken(trimmed);
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== `${QR_LOGIN_SCHEME}:`) {
    return null;
  }

  if (url.hostname !== QR_LOGIN_PATH && url.pathname.replace(/^\//, '') !== QR_LOGIN_PATH) {
    return null;
  }

  if (url.searchParams.get('v') !== QR_LOGIN_VERSION) {
    return null;
  }

  const token = url.searchParams.get('token');

  if (token === null) {
    return null;
  }

  return decodeLoginToken(token);
}

function decodeLoginToken(token: string): string | null {
  if (!BASE64URL.test(token)) {
    return null;
  }

  try {
    const bytes = Buffer.from(token, 'base64url');

    if (bytes.length !== QR_LOGIN_TOKEN_BYTES) {
      return null;
    }
  } catch {
    return null;
  }

  return token;
}
