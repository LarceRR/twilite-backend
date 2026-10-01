import { ConflictError, NotFoundError } from '@/shared/errors';

type ReviewableTheme = {
  readonly status: string;
};

/**
 * Self-moderation is allowed: access is gated by RBAC `tpg.themes.moderate`,
 * not by author ≠ reviewer.
 */
export function assertThemePendingForReview(
  theme: ReviewableTheme | null,
): asserts theme is ReviewableTheme {
  if (theme === null) {
    throw new NotFoundError('Тема не найдена', { code: 'THEME_NOT_FOUND' });
  }
  if (theme.status !== 'pending') {
    throw new ConflictError('Тема уже обработана', { code: 'THEME_ALREADY_REVIEWED' });
  }
}
