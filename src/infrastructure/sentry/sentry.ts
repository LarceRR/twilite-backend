import * as Sentry from '@sentry/node';

import type { AppConfig } from '@/config/env';
import { AppError } from '@/shared/errors';

/**
 * Initialised before the Nest app so instrumentation wraps everything. Expected
 * failures (validation, permissions, conflicts) are not reported: they are normal
 * traffic, and reporting them buries real bugs.
 */
export function initSentry(config: AppConfig): void {
  if (config.sentry.dsn.length === 0) {
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.app.env,
    tracesSampleRate: config.app.isProduction ? 0.1 : 0,
  });
}

const REPORTABLE_KINDS = new Set(['infrastructure', 'unknown']);

export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  if (error instanceof AppError && !REPORTABLE_KINDS.has(error.kind)) {
    return;
  }

  Sentry.captureException(error, { extra: context });
}
