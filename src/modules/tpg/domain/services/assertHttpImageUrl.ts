import { ValidationError } from '@/shared/errors';

/** Only remote public http(s) URLs — blocks file://, localhost and private nets. */
export function assertHttpImageUrl(raw: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError('Некорректный URL изображения', [
      { path: 'imageUrl', message: 'URL не удалось разобрать' },
    ]);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Некорректный URL изображения', [
      { path: 'imageUrl', message: 'Допускаются только http и https' },
    ]);
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new ValidationError('Некорректный URL изображения', [
      { path: 'imageUrl', message: 'Локальные и приватные адреса запрещены' },
    ]);
  }

  return parsed;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') {
    return true;
  }

  if (host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  // IPv4 private / link-local / loopback
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  // Common IPv6 ULA / link-local prefixes (string check; enough for SSRF basics)
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return true;
  }

  return false;
}
