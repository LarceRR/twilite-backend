import { describe, expect, it, vi } from 'vitest';

import { InfrastructureError } from '@/shared/errors';

import { assertCriticalDependencies, probeDependencies } from './dependencyChecks';

describe('dependencyChecks', () => {
  it('считает обе зависимости up при успешных probe', async () => {
    const db = { execute: vi.fn().mockResolvedValue([]) };
    const redis = { ping: vi.fn().mockResolvedValue('PONG') };

    await expect(probeDependencies(db as never, redis as never)).resolves.toEqual({
      database: 'up',
      cache: 'up',
    });
  });

  it('помечает dependency down при ошибке probe', async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error('db down')) };
    const redis = { ping: vi.fn().mockRejectedValue(new Error('redis down')) };

    await expect(probeDependencies(db as never, redis as never)).resolves.toEqual({
      database: 'down',
      cache: 'down',
    });
  });

  it('не бросает, когда database и redis доступны', async () => {
    const db = { execute: vi.fn().mockResolvedValue([]) };
    const redis = { ping: vi.fn().mockResolvedValue('PONG') };

    await expect(assertCriticalDependencies(db as never, redis as never)).resolves.toBeUndefined();
  });

  it('бросает, если недоступна хотя бы одна критическая зависимость', async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error('db down')) };
    const redis = { ping: vi.fn().mockResolvedValue('PONG') };

    await expect(assertCriticalDependencies(db as never, redis as never)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
    await expect(assertCriticalDependencies(db as never, redis as never)).rejects.toMatchObject({
      message: 'Критические зависимости недоступны: database',
      context: { checks: { database: 'down', cache: 'up' } },
    });
  });

  it('перечисляет обе зависимости, если недоступны обе', async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error('db down')) };
    const redis = { ping: vi.fn().mockRejectedValue(new Error('redis down')) };

    await expect(assertCriticalDependencies(db as never, redis as never)).rejects.toMatchObject({
      message: 'Критические зависимости недоступны: database, cache',
    });
  });
});
