import { z } from 'zod';

import { isoDateTime, uuidSchema } from './common';
import { AVATAR_CONTENT_TYPES } from './media';

const projectDescriptionSchema = z.string().trim().max(500);

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    description: projectDescriptionSchema.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    description: projectDescriptionSchema.optional(),
    /** Pass null to clear a custom avatar (fallback to last object preview). */
    clearAvatar: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.clearAvatar !== undefined,
    {
      message: 'Нужно хотя бы одно поле',
    },
  );

export const reassignProjectSchema = z
  .object({
    toUserId: uuidSchema,
  })
  .strict();

export const createProjectAvatarUploadSchema = z
  .object({
    contentType: z.enum(AVATAR_CONTENT_TYPES),
    byteSize: z.number().int().min(1),
  })
  .strict();

export const projectDtoSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  description: z.string(),
  ownerUserId: uuidSchema,
  ownerDisplayName: z.string(),
  avatarUrl: z.string().nullable(),
  objectCount: z.number().int().min(0),
  /** Bucket for objects handed to this user without a chosen project. */
  isReassignmentInbox: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const projectListSchema = z.object({
  items: z.array(projectDtoSchema),
  nextCursor: z.string().nullable().optional(),
});

export const projectLimitsSchema = z
  .object({
    projectsPerUser: z.number().int().min(1),
    objectsPerProject: z.number().int().min(1),
    titleMax: z.number().int().min(1),
  })
  .strict();

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ReassignProjectDto = z.infer<typeof reassignProjectSchema>;
export type CreateProjectAvatarUploadDto = z.infer<typeof createProjectAvatarUploadSchema>;
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type ProjectListDto = z.infer<typeof projectListSchema>;
export type ProjectLimits = z.infer<typeof projectLimitsSchema>;
