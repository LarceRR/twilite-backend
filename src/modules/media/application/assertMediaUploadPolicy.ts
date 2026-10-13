import type { AppLimits } from '@/config/limits';
import { DomainError, ValidationError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

import { policyForKind } from '../domain/mediaKindPolicy';

export function assertMediaUploadPolicy(input: {
  readonly kind: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly limits: AppLimits;
}): void {
  const policy = policyForKind(input.kind);
  if (policy === null) {
    throw new ValidationError('Неизвестный тип медиа', [
      { path: 'kind', message: `Неподдерживаемый kind: ${input.kind}` },
    ]);
  }

  if (!policy.contentTypes.includes(input.contentType)) {
    throw new ValidationError('Недопустимый Content-Type', [
      {
        path: 'contentType',
        message: `Для ${input.kind} допускаются: ${policy.contentTypes.join(', ')}`,
      },
    ]);
  }

  const maxBytes = policy.maxBytes(input.limits);
  if (input.byteSize > maxBytes) {
    throw new ValidationError('Файл слишком большой', [
      { path: 'byteSize', message: `Максимум ${maxBytes} байт` },
    ]);
  }
}

export function mediaQuotaExceededError(limit: number): DomainError {
  return new DomainError(
    'Дневная квота загрузок исчерпана',
    { limit },
    { code: ErrorCode.MEDIA_QUOTA_EXCEEDED, httpStatus: 429 },
  );
}
