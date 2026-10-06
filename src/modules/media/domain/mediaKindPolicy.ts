import type { AppLimits } from '@/config/limits';

export type MediaKind = 'image' | 'voice' | 'attachment' | 'avatar' | 'project-avatar' | 'pixel-sheet';

export type MediaKindPolicy = {
  readonly kind: MediaKind;
  readonly contentTypes: readonly string[];
  readonly maxBytes: (limits: AppLimits) => number;
  /** Public objects may be served without auth; private need signed URLs. */
  readonly privacy: 'public' | 'private';
  /** Pending ticket retention before GC (hours). */
  readonly pendingRetentionHours: number;
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const VOICE_TYPES = ['audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/webm'] as const;

/** Single registry for upload policy (P1-S4). */
export const MEDIA_KIND_POLICIES: Readonly<Record<MediaKind, MediaKindPolicy>> = {
  image: {
    kind: 'image',
    contentTypes: IMAGE_TYPES,
    maxBytes: (limits) => limits.media.imageMaxBytes,
    privacy: 'private',
    pendingRetentionHours: 24,
  },
  voice: {
    kind: 'voice',
    contentTypes: VOICE_TYPES,
    maxBytes: (limits) => limits.media.audioMaxBytes,
    privacy: 'private',
    pendingRetentionHours: 24,
  },
  attachment: {
    kind: 'attachment',
    contentTypes: [...IMAGE_TYPES, 'application/pdf', 'text/plain'],
    maxBytes: (limits) => limits.media.imageMaxBytes,
    privacy: 'private',
    pendingRetentionHours: 24,
  },
  avatar: {
    kind: 'avatar',
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: (limits) => limits.media.avatarMaxBytes,
    privacy: 'public',
    pendingRetentionHours: 24,
  },
  'project-avatar': {
    kind: 'project-avatar',
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: (limits) => limits.media.avatarMaxBytes,
    privacy: 'public',
    pendingRetentionHours: 24,
  },
  'pixel-sheet': {
    kind: 'pixel-sheet',
    contentTypes: ['image/png'],
    maxBytes: (limits) => Math.min(limits.media.imageMaxBytes, 8 * 1024 * 1024),
    privacy: 'public',
    pendingRetentionHours: 24,
  },
};

export function policyForKind(kind: string): MediaKindPolicy | null {
  if (kind in MEDIA_KIND_POLICIES) {
    return MEDIA_KIND_POLICIES[kind as MediaKind];
  }
  return null;
}
