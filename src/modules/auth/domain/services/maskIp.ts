import { createHash } from 'node:crypto';

/**
 * Show the phone just enough network context to confirm "this is my computer"
 * without storing or displaying a precise address.
 */
export function maskIp(ip: string): string {
  const value = ip.trim().toLowerCase();

  if (value.length === 0) {
    return 'unknown';
  }

  if (value.includes(':')) {
    const cleaned = value.replace(/^\[|\]$/g, '');
    const parts = cleaned.split(':').filter((part) => part.length > 0);

    if (parts.length === 0) {
      return 'unknown';
    }

    return `${parts.slice(0, 2).join(':')}:x`;
  }

  const parts = value.split('.');

  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }

  return 'unknown';
}

/** Short fingerprint for rate-limit keys — not reversible to the original value. */
export function hashClientKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}
