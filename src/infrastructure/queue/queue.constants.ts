/** Heavy or retryable work never happens inside a request. */
export const queueNames = {
  cleanup: 'cleanup',
  analytics: 'analytics',
  media: 'media',
} as const;

export const jobNames = {
  expireSessions: 'expire-sessions',
  trackEvent: 'track-event',
  confirmUpload: 'confirm-upload',
  gcPendingMedia: 'gc-pending-media',
} as const;

export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 3_600, count: 500 },
  removeOnFail: { age: 86_400 },
} as const;
