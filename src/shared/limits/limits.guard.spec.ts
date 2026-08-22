import { describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@/shared/errors/AppError';
import { ValidationError } from '@/shared/errors';

import { loadLimits } from '@/config/limits';

import {
  assertJsonWithinLimits,
  assertMaxBytes,
  assertMaxCount,
  assertMaxLength,
  utf8ByteLength,
} from './limits.guard';

const limits = loadLimits({});

type MomentResult = { readonly ok: boolean };

function objectWithKeys(count: number): Record<string, number> {
  const result: Record<string, number> = {};

  for (let index = 0; index < count; index += 1) result[`k${index}`] = 1;

  return result;
}

describe('отклонение по лимиту (#38)', () => {
  it('пропускает значение на границе', () => {
    expect(() =>
      assertMaxLength(
        'text',
        'a'.repeat(limits.moments.textMaxLength),
        limits.moments.textMaxLength,
      ),
    ).not.toThrow();
  });

  it('отклоняет превышение стабильным кодом VALIDATION_FAILED', () => {
    try {
      assertMaxLength(
        'text',
        'a'.repeat(limits.moments.textMaxLength + 1),
        limits.moments.textMaxLength,
      );
      expect.unreachable('лимит должен отклонить значение');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe(ErrorCode.VALIDATION_FAILED);
      expect((error as ValidationError).httpStatus).toBe(400);
    }
  });

  it('не возвращает пользовательский текст в ошибке', () => {
    const secret = 'очень личный текст момента';

    try {
      assertMaxLength('text', secret, 5);
      expect.unreachable('лимит должен отклонить значение');
    } catch (error) {
      const body = JSON.stringify((error as ValidationError).toPublicJson());

      expect(body).not.toContain(secret);
      expect(body).toContain('text');
    }
  });

  it('считает длину в кодовых точках, а не в UTF-16 единицах', () => {
    expect(() => assertMaxLength('text', '👩‍❤️‍👨', 6)).not.toThrow();
  });

  it('проверяет размер в байтах по UTF-8', () => {
    expect(utf8ByteLength('привет')).toBe(12);
    expect(() => assertMaxBytes('metadata', utf8ByteLength('привет'), 11)).toThrow(ValidationError);
  });

  it('ограничивает JSON по размеру, ключам и глубине', () => {
    const jsonLimits = {
      maxBytes: limits.moments.metadataMaxBytes,
      maxKeys: limits.moments.metadataMaxKeys,
      maxDepth: limits.http.jsonDepthMax,
    };

    expect(() => assertJsonWithinLimits('metadata', { mood: 'ok' }, jsonLimits)).not.toThrow();
    expect(() =>
      assertJsonWithinLimits('metadata', { blob: 'x'.repeat(jsonLimits.maxBytes) }, jsonLimits),
    ).toThrow(ValidationError);
    expect(() =>
      assertJsonWithinLimits('metadata', objectWithKeys(jsonLimits.maxKeys + 1), jsonLimits),
    ).toThrow(ValidationError);

    let deep: unknown = 'leaf';
    for (let level = 0; level < jsonLimits.maxDepth + 1; level += 1) deep = { nested: deep };

    expect(() => assertJsonWithinLimits('metadata', deep, jsonLimits)).toThrow(ValidationError);
  });

  it('отклоняет превышение количества', () => {
    expect(() =>
      assertMaxCount('members', limits.spaces.membersPerSpace + 1, limits.spaces.membersPerSpace),
    ).toThrow(ValidationError);
  });

  /**
   * Ключевой инвариант: idempotent retry не должен обходить лимит. Проверка идёт
   * до replay-обёртки, поэтому сохранённый ответ даже не запрашивается.
   */
  it('проверяет лимит до idempotent replay', async () => {
    const mutation = vi.fn(async (): Promise<MomentResult> => ({ ok: true }));
    const replay = vi.fn(
      async (operation: () => Promise<MomentResult>): Promise<MomentResult> => operation(),
    );

    const createMoment = async (text: string): Promise<MomentResult> => {
      assertMaxLength('text', text, limits.moments.textMaxLength);

      return replay(mutation);
    };

    await expect(createMoment('a'.repeat(limits.moments.textMaxLength + 1))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(replay).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();

    await expect(createMoment('ok')).resolves.toEqual({ ok: true });
    expect(replay).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledTimes(1);
  });
});
