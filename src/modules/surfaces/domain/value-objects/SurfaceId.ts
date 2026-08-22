import { ValidationError } from '@/shared/errors';
import type { Brand } from '@/shared/types/Brand';

export type SurfaceId = Brand<string, 'SurfaceId'>;

export function toSurfaceId(value: string): SurfaceId {
  if (value.trim().length === 0) {
    throw new ValidationError('Пустой идентификатор поверхности');
  }

  return value as SurfaceId;
}
