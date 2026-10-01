import { z } from 'zod';

import { isoDateTime, uuidSchema } from '@/shared/contracts/common.contract';

export const adminPermissionSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  descriptionEn: z.string(),
  descriptionRu: z.string(),
  module: z.string(),
});

export const adminGroupSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  descriptionEn: z.string(),
  descriptionRu: z.string(),
  parentGroupId: uuidSchema.nullable(),
  isDefault: z.boolean(),
  permissionIds: z.array(uuidSchema),
  permissionNames: z.array(z.string()),
});

export const updateGroupRequestSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  descriptionEn: z.string().min(1).max(500).optional(),
  descriptionRu: z.string().min(1).max(500).optional(),
  parentGroupId: uuidSchema.nullable().optional(),
  permissionIds: z.array(uuidSchema).optional(),
});

export const adminUserSummarySchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: isoDateTime,
});

export const adminUserDetailSchema = adminUserSummarySchema.extend({
  groups: z.array(z.object({ id: uuidSchema, name: z.string() })),
  overrides: z.array(
    z.object({
      permissionId: uuidSchema,
      permissionName: z.string(),
      type: z.enum(['GRANT', 'DENY']),
    }),
  ),
  permissions: z.array(z.string()),
});

export const setUserPermissionsRequestSchema = z.object({
  overrides: z.array(
    z.object({
      permissionId: uuidSchema,
      type: z.enum(['GRANT', 'DENY']),
    }),
  ),
});

export type UpdateGroupRequestDto = z.infer<typeof updateGroupRequestSchema>;
export type SetUserPermissionsRequestDto = z.infer<typeof setUserPermissionsRequestSchema>;
