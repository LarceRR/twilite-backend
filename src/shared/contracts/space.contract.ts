import { z } from 'zod';

import { spacePermissions } from '@/modules/spaces/domain/value-objects/SpacePermission';

import { isoDateTime, uuidSchema, versionSchema } from './common.contract';

export const spacePermissionSchema = z.enum(spacePermissions);

export const spaceMemberSchema = z.object({
  userId: uuidSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['Owner', 'Member']),
  permissions: z.array(spacePermissionSchema),
  joinedAt: isoDateTime,
});

export const spaceSchema = z.object({
  id: uuidSchema,
  type: z.enum(['Personal', 'Shared']),
  title: z.string(),
  ownerId: uuidSchema,
  members: z.array(spaceMemberSchema),
  createdAt: isoDateTime,
  version: versionSchema,
});

export const createSpaceRequestSchema = z.object({
  title: z.string().min(1).max(80),
  // Personal spaces are created with the account, so only Shared is requestable.
  type: z.literal('Shared').default('Shared'),
});

export const inviteMemberRequestSchema = z.object({
  email: z.string().email(),
  permissions: z.array(spacePermissionSchema).optional(),
});

export const invitationSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  spaceTitle: z.string(),
  invitedByUserId: uuidSchema,
  inviteeEmail: z.string().email(),
  permissions: z.array(spacePermissionSchema),
  status: z.enum(['Pending', 'Accepted', 'Rejected', 'Revoked']),
  createdAt: isoDateTime,
  respondedAt: isoDateTime.nullable(),
});

export const respondInvitationRequestSchema = z.object({
  accept: z.boolean(),
});

export type SpaceDto = z.infer<typeof spaceSchema>;
export type SpaceMemberDto = z.infer<typeof spaceMemberSchema>;
export type InvitationDto = z.infer<typeof invitationSchema>;
export type CreateSpaceRequestDto = z.infer<typeof createSpaceRequestSchema>;
export type InviteMemberRequestDto = z.infer<typeof inviteMemberRequestSchema>;
