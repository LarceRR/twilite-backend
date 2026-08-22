import { z } from 'zod';

import { surfaceObjectStates } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectState';

import { isoDateTime, uuidSchema, versionSchema } from './common.contract';

export const surfaceObjectStateSchema = z.enum(surfaceObjectStates);

/**
 * `kind` is a string, not an enum: the registry is open, and an older client must
 * not break when a new kind appears.
 */
export const surfaceObjectKindSchema = z
  .string()
  .min(1)
  .max(40)
  .describe('Open registry. Known values: Fire, Cloud');

export const surfaceObjectSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  surfaceId: uuidSchema,
  cellX: z.number().int(),
  cellY: z.number().int(),
  kind: surfaceObjectKindSchema,
  state: surfaceObjectStateSchema,
  createdByUserId: uuidSchema,
  subjectUserId: uuidSchema,
  metadata: z.record(z.string(), z.unknown()),
  favorite: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  version: versionSchema,
});

export const surfaceBoundsSchema = z.object({
  minX: z.number().int(),
  maxX: z.number().int(),
  minY: z.number().int(),
  maxY: z.number().int(),
});

export const surfaceSchema = z.object({
  id: uuidSchema,
  spaceId: uuidSchema,
  bounds: surfaceBoundsSchema,
  version: versionSchema,
});

export const surfaceSnapshotSchema = z.object({
  surface: surfaceSchema,
  objects: z.array(surfaceObjectSchema),
});

/** Note the absence of cellX/cellY: the position is the domain's decision. */
export const createSurfaceObjectRequestSchema = z.object({
  kind: surfaceObjectKindSchema,
  subjectUserId: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const changeStateRequestSchema = z.object({
  transition: z.enum(['activate', 'soften', 'age']),
  version: versionSchema,
});

export const updateSurfaceObjectRequestSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  favorite: z.boolean().optional(),
  version: versionSchema,
});

export const deleteSurfaceObjectQuerySchema = z.object({
  version: z.coerce.number().int().min(1),
});

export const kindPolicySchema = z.object({
  kind: surfaceObjectKindSchema,
  valence: z.enum(['positive', 'negative', 'neutral']),
  allowSelfSubject: z.boolean(),
  spawnRadius: z.number().int(),
  minSeparation: z.number().int().min(1),
});

export type SurfaceObjectDto = z.infer<typeof surfaceObjectSchema>;
export type SurfaceDto = z.infer<typeof surfaceSchema>;
export type SurfaceSnapshotDto = z.infer<typeof surfaceSnapshotSchema>;
export type CreateSurfaceObjectRequestDto = z.infer<typeof createSurfaceObjectRequestSchema>;
export type ChangeStateRequestDto = z.infer<typeof changeStateRequestSchema>;
export type UpdateSurfaceObjectRequestDto = z.infer<typeof updateSurfaceObjectRequestSchema>;
export type KindPolicyDto = z.infer<typeof kindPolicySchema>;
