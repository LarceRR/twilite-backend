import { ValidationError } from '@/shared/errors';

import type { LimitUnit } from '@/config/limits';

/**
 * Отклонение по лимиту (issue #38).
 *
 * Порядок обязателен: проверка лимита выполняется до бизнес-операции, до вызова
 * внешнего провайдера и до idempotent replay. Иначе повторный запрос с тем же
 * idempotency key вернул бы сохранённый ответ и обошёл лимит.
 *
 * В ошибку попадают только имя поля, фактический размер, предел и единица.
 * Пользовательский текст, payload и токены не логируются и не возвращаются.
 */
function limitExceeded(
  field: string,
  actual: number,
  limit: number,
  unit: LimitUnit,
): ValidationError {
  return new ValidationError('Превышен допустимый предел', [
    { path: field, message: `${actual} > ${limit} ${unit}` },
  ]);
}

/** Считаем кодовые точки, а не UTF-16 единицы: эмодзи не должно стоить двойного лимита. */
export function assertMaxLength(field: string, value: string, limit: number): void {
  const length = [...value].length;

  if (length > limit) throw limitExceeded(field, length, limit, 'characters');
}

export function assertMinLength(field: string, value: string, limit: number): void {
  const length = [...value].length;

  if (length < limit) {
    throw new ValidationError('Значение короче допустимого', [
      { path: field, message: `${length} < ${limit} characters` },
    ]);
  }
}

export function assertMaxBytes(field: string, byteLength: number, limit: number): void {
  if (byteLength > limit) throw limitExceeded(field, byteLength, limit, 'bytes');
}

export function assertMaxCount(field: string, count: number, limit: number): void {
  if (count > limit) throw limitExceeded(field, count, limit, 'items');
}

export function assertMaxSeconds(field: string, seconds: number, limit: number): void {
  if (seconds > limit) throw limitExceeded(field, seconds, limit, 'seconds');
}

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export type JsonLimits = {
  readonly maxBytes: number;
  readonly maxKeys: number;
  readonly maxDepth: number;
};

/**
 * JSON, пришедший от пользователя (metadata момента, payload обращения), проверяется
 * по размеру, числу ключей верхнего уровня и глубине: глубина ограничивает
 * стоимость обхода и защищает сериализацию в БД.
 */
export function assertJsonWithinLimits(field: string, value: unknown, limits: JsonLimits): void {
  let serialized: string;

  try {
    serialized = JSON.stringify(value ?? null);
  } catch {
    throw new ValidationError('Значение не сериализуется в JSON', [
      { path: field, message: 'not serializable' },
    ]);
  }

  assertMaxBytes(field, utf8ByteLength(serialized), limits.maxBytes);

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    assertMaxCount(`${field}.keys`, Object.keys(value).length, limits.maxKeys);
  }

  const depth = jsonDepth(value);

  if (depth > limits.maxDepth)
    throw limitExceeded(`${field}.depth`, depth, limits.maxDepth, 'items');
}

function jsonDepth(value: unknown, current = 1): number {
  if (value === null || typeof value !== 'object') return current;

  const entries: readonly unknown[] = Array.isArray(value) ? value : Object.values(value);

  if (entries.length === 0) return current;

  let deepest = current;

  for (const entry of entries) {
    const depth = jsonDepth(entry, current + 1);

    if (depth > deepest) deepest = depth;
  }

  return deepest;
}
