import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

import { AuthenticationError } from '@/shared/errors';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const FORMAT_VERSION = 'scrypt1';

/**
 * scrypt from the standard library: memory-hard, no native build step, nothing to
 * keep patched. The hash carries its own salt and version so the parameters can be
 * changed later without invalidating existing passwords.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = await scryptAsync(password, salt, KEY_BYTES);

    return `${FORMAT_VERSION}:${salt.toString('base64')}:${derived.toString('base64')}`;
  }

  async verify(password: string, storedHash: string): Promise<void> {
    const [version, saltPart, hashPart] = storedHash.split(':');

    if (version !== FORMAT_VERSION || saltPart === undefined || hashPart === undefined) {
      throw new AuthenticationError('Неверная почта или пароль');
    }

    const expected = Buffer.from(hashPart, 'base64');
    const actual = await scryptAsync(password, Buffer.from(saltPart, 'base64'), expected.length);

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new AuthenticationError('Неверная почта или пароль');
    }
  }
}
