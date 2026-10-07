import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/shared/errors';

import { assertHttpImageUrl } from './assertHttpImageUrl';

describe('assertHttpImageUrl', () => {
  it('принимает http и https', () => {
    expect(assertHttpImageUrl('https://example.com/a.png').protocol).toBe('https:');
    expect(assertHttpImageUrl('http://example.com/a.png').protocol).toBe('http:');
  });

  it('отклоняет не-URL и опасные схемы', () => {
    expect(() => assertHttpImageUrl('not-a-url')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('file:///etc/passwd')).toThrow(ValidationError);
  });

  it('блокирует localhost и приватные сети (SSRF)', () => {
    expect(() => assertHttpImageUrl('http://localhost/a.png')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('http://127.0.0.1/a.png')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('http://192.168.0.1/a.png')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('http://10.0.0.5/a.png')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('http://169.254.169.254/latest')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('http://[::1]/a.png')).toThrow(ValidationError);
    expect(() => assertHttpImageUrl('http://[fe80::1]/a.png')).toThrow(ValidationError);
  });
});
