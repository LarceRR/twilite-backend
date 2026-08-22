import type { Redis } from 'ioredis';

export const CACHE = Symbol('CACHE');

/**
 * Cache-aside only. Postgres is always the write path and the source of truth;
 * anything here may vanish at any moment without changing correctness.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  remember<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T>;
  invalidate(...keys: string[]): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}

export class RedisCache implements Cache {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      // A poisoned entry must never take a request down.
      await this.client.del(key);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async remember<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await load();
    await this.set(key, value, ttlSeconds);

    return value;
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.client.del(...keys);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    // SCAN rather than KEYS: never block the server on a large keyspace.
    let cursor = '0';

    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;

      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }
}
