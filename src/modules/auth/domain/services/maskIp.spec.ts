import { describe, expect, it } from 'vitest';

import { hashClientKey, maskIp } from './maskIp';

describe('maskIp', () => {
  it('прячет последний октет IPv4', () => {
    expect(maskIp('203.0.113.45')).toBe('203.0.113.x');
  });

  it('оставляет только префикс IPv6', () => {
    expect(maskIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:x');
  });

  it('не показывает мусор как адрес', () => {
    expect(maskIp('')).toBe('unknown');
    expect(maskIp('not-an-ip')).toBe('unknown');
  });

  it('хеширует ключ лимитера до фиксированной длины', () => {
    expect(hashClientKey('127.0.0.1')).toHaveLength(24);
    expect(hashClientKey('127.0.0.1')).toBe(hashClientKey('127.0.0.1'));
    expect(hashClientKey('127.0.0.1')).not.toBe(hashClientKey('10.0.0.1'));
  });
});
