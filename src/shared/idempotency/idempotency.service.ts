import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { idempotencyRecords } from '@/database/schema';
import { ConflictError } from '@/shared/errors';

export type IdempotencyKey = string | null | undefined;
type StoredValue = Record<string, unknown> | readonly unknown[] | string | number | boolean | null;

/** Durable replay wrapper for retryable mutations. */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async execute<T>(params: {
    key: IdempotencyKey;
    scope: string;
    payload: unknown;
    operation: () => Promise<T>;
  }): Promise<T> {
    if (params.key === undefined || params.key === null || params.key.trim() === '')
      return params.operation();
    const key = params.key.trim();
    if (key.length > 200) throw new ConflictError('Слишком длинный idempotency key');
    const requestHash = hash({ scope: params.scope, payload: params.payload });
    const now = new Date();
    const existing = await this.db.query.idempotencyRecords.findFirst({
      where: (table, operators) =>
        and(operators.eq(table.scope, params.scope), operators.eq(table.key, key)),
    });
    if (existing !== undefined && existing.expiresAt > now) {
      if (existing.requestHash !== requestHash)
        throw new ConflictError('Idempotency key уже использован для другого запроса');
      if (existing.status === 'pending')
        throw new ConflictError('Операция с этим idempotency key уже выполняется');
      return revive(existing.response as StoredValue) as T;
    }
    if (existing !== undefined)
      await this.db.delete(idempotencyRecords).where(eq(idempotencyRecords.id, existing.id));

    let reservationId: string;
    try {
      const [reservation] = await this.db
        .insert(idempotencyRecords)
        .values({
          scope: params.scope,
          key,
          requestHash,
          status: 'pending',
          response: null,
          statusCode: null,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        })
        .returning({ id: idempotencyRecords.id });
      if (reservation === undefined)
        throw new ConflictError('Не удалось создать idempotency reservation');
      reservationId = reservation.id;
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      const winner = await this.db.query.idempotencyRecords.findFirst({
        where: (table, operators) =>
          and(
            operators.eq(table.scope, params.scope),
            operators.eq(table.key, key),
            gt(table.expiresAt, now),
          ),
      });
      if (winner?.requestHash !== requestHash)
        throw new ConflictError('Idempotency key уже использован для другого запроса');
      throw new ConflictError('Операция с этим idempotency key уже выполняется');
    }

    const result = await params.operation();
    await this.db
      .update(idempotencyRecords)
      .set({ status: 'completed', response: result as StoredValue, statusCode: 200 })
      .where(eq(idempotencyRecords.id, reservationId));
    return result;
  }
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function revive(value: StoredValue): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        typeof entry === 'string' && /(At|Date)$/.test(key)
          ? new Date(entry)
          : revive(entry as StoredValue),
      ]),
    );
  return value;
}
