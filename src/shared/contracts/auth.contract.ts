import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common.contract';

export const deviceInfoSchema = z.object({
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  model: z.string().max(120).nullish(),
  appVersion: z.string().max(40).nullish(),
});

export const authSessionSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: isoDateTime,
  userId: uuidSchema,
});

export const signUpRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80),
  device: deviceInfoSchema.optional(),
});

export const signInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  device: deviceInfoSchema.optional(),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const qrLoginStatusSchema = z.enum(['pending', 'scanned', 'approved', 'denied', 'expired']);

export const qrLoginStartRequestSchema = z.object({
  device: deviceInfoSchema.optional(),
});

export const qrLoginStartResponseSchema = z.object({
  challengeId: uuidSchema,
  qrPayload: z.string().min(1),
  pollToken: z.string().min(1),
  expiresAt: isoDateTime,
  expiresInSeconds: z.number().int().positive(),
});

export const qrLoginStatusRequestSchema = z.object({
  challengeId: uuidSchema,
  pollToken: z.string().min(16).max(128),
});

export const qrLoginStatusResponseSchema = z.object({
  status: qrLoginStatusSchema,
  session: authSessionSchema.optional(),
});

export const qrLoginTokenRequestSchema = z.object({
  token: z.string().min(1).max(256),
});

export const qrLoginInspectResponseSchema = z.object({
  challengeId: uuidSchema,
  expiresAt: isoDateTime,
  requestingDevice: deviceInfoSchema.extend({
    ipLabel: z.string(),
  }),
});

export const qrLoginDecisionResponseSchema = z.object({
  status: z.enum(['approved', 'denied']),
});

export const userProfileSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: isoDateTime,
  preferences: z.object({
    locale: z.string(),
    soundEnabled: z.boolean(),
    hapticsEnabled: z.boolean(),
    reduceMotion: z.boolean(),
    pushEnabled: z.boolean(),
  }),
  groups: z.array(z.object({ id: uuidSchema, name: z.string() })).default([]),
  permissions: z.array(z.string()).default([]),
});

export const sessionSchema = z.object({
  id: uuidSchema,
  device: deviceInfoSchema,
  ipLabel: z.string().nullable(),
  createdAt: isoDateTime,
  lastUsedAt: isoDateTime,
  expiresAt: isoDateTime,
  current: z.boolean(),
});

export type AuthSessionDto = z.infer<typeof authSessionSchema>;
export type SignUpRequestDto = z.infer<typeof signUpRequestSchema>;
export type SignInRequestDto = z.infer<typeof signInRequestSchema>;
export type RefreshRequestDto = z.infer<typeof refreshRequestSchema>;
export type UserProfileDto = z.infer<typeof userProfileSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type DeviceInfoDto = z.infer<typeof deviceInfoSchema>;
export type QrLoginStartRequestDto = z.infer<typeof qrLoginStartRequestSchema>;
export type QrLoginStartResponseDto = z.infer<typeof qrLoginStartResponseSchema>;
export type QrLoginStatusRequestDto = z.infer<typeof qrLoginStatusRequestSchema>;
export type QrLoginStatusResponseDto = z.infer<typeof qrLoginStatusResponseSchema>;
export type QrLoginTokenRequestDto = z.infer<typeof qrLoginTokenRequestSchema>;
export type QrLoginInspectResponseDto = z.infer<typeof qrLoginInspectResponseSchema>;
export type QrLoginDecisionResponseDto = z.infer<typeof qrLoginDecisionResponseSchema>;
