/** Heavy or retryable work never happens inside a request. */
export const queueNames = {
  ai: 'ai',
  push: 'push',
  email: 'email',
  cleanup: 'cleanup',
  analytics: 'analytics',
  media: 'media',
  surfaceLifecycle: 'surface-lifecycle',
} as const;

export const jobNames = {
  generateInsight: 'generate-insight',
  sendPush: 'send-push',
  sendInvitationEmail: 'send-invitation-email',
  expireSessions: 'expire-sessions',
  ageSurfaceObjects: 'age-surface-objects',
  trackEvent: 'track-event',
  confirmUpload: 'confirm-upload',
} as const;

export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 3_600, count: 500 },
  removeOnFail: { age: 86_400 },
} as const;
