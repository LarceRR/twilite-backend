import { ValidationError } from '@/shared/errors';
import type { Brand } from '@/shared/types/Brand';

export type UserId = Brand<string, 'UserId'>;

export function toUserId(value: string): UserId {
  if (value.trim().length === 0) {
    throw new ValidationError('Пустой идентификатор пользователя');
  }

  return value as UserId;
}
