import { describe, expect, it } from 'vitest';

import {
  buildQrLoginPayload,
  createQrSecret,
  hashQrSecret,
  parseQrLoginPayload,
  QR_LOGIN_TOKEN_BYTES,
  qrSecretsMatch,
} from './qrLoginTokens';

describe('qrLoginTokens', () => {
  it('выдаёт непредсказуемые секреты фиксированной длины', () => {
    const first = createQrSecret();
    const second = createQrSecret();

    expect(first).not.toBe(second);
    expect(Buffer.from(first, 'base64url').length).toBe(QR_LOGIN_TOKEN_BYTES);
    expect(parseQrLoginPayload(first)).toBe(first);
  });

  it('собирает не-URI payload и читает его обратно', () => {
    const token = createQrSecret();
    const payload = buildQrLoginPayload(token);

    expect(payload.startsWith('twilite.login.v1.')).toBe(true);
    expect(payload.includes('://')).toBe(false);
    expect(payload).not.toContain('poll');
    expect(parseQrLoginPayload(payload)).toBe(token);
    expect(parseQrLoginPayload(`twilite://login?v=1&token=${token}`)).toBe(token);
  });

  it('отклоняет чужие схемы, чужую версию и короткий токен', () => {
    const token = createQrSecret();

    expect(parseQrLoginPayload(`tg://login?v=1&token=${token}`)).toBeNull();
    expect(parseQrLoginPayload(`https://evil.test/login?v=1&token=${token}`)).toBeNull();
    expect(parseQrLoginPayload(`javascript:alert(1)`)).toBeNull();
    expect(parseQrLoginPayload(`twilite://login?v=2&token=${token}`)).toBeNull();
    expect(parseQrLoginPayload('twilite://login?v=1&token=short')).toBeNull();
    expect(parseQrLoginPayload('')).toBeNull();
  });

  it('сравнивает секреты по хешу без ложных совпадений', () => {
    const secret = createQrSecret();
    const stored = hashQrSecret(secret);

    expect(qrSecretsMatch(stored, secret)).toBe(true);
    expect(qrSecretsMatch(stored, createQrSecret())).toBe(false);
    expect(hashQrSecret(secret)).toBe(stored);
  });
});
