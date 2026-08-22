import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common.contract';

export const deviceInfoSchema = z.object({
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  model: z.string().max(120).nullish(),
  appVersion: z.string().max(40).nullish(),
});

export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
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
  refreshToken: z.string().min(1),
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
});

export const sessionSchema = z.object({
  id: uuidSchema,
  device: deviceInfoSchema,
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
