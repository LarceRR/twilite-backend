import { DomainError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';

/** Authors cannot moderate their own pixel objects unless admin override. */
export function assertNotSelfModeration(input: {
  readonly authorUserId: string;
  readonly reviewerUserId: string;
  readonly allowSelf?: boolean;
}): void {
  if (input.allowSelf === true) {
    return;
  }
  if (input.authorUserId === input.reviewerUserId) {
    throw new DomainError(
      'Нельзя модерировать собственный объект',
      {},
      { code: ErrorCode.PIXEL_OBJECT_SELF_MODERATION, httpStatus: 403 },
    );
  }
}
