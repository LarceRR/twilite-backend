import { createZodDto } from 'nestjs-zod';

import {
  changeStateRequestSchema,
  createSurfaceObjectRequestSchema,
  deleteSurfaceObjectQuerySchema,
  kindPolicySchema,
  surfaceObjectSchema,
  surfaceSnapshotSchema,
  updateSurfaceObjectRequestSchema,
} from '@/shared/contracts/surface.contract';

export class CreateSurfaceObjectDto extends createZodDto(createSurfaceObjectRequestSchema) {}
export class ChangeStateDto extends createZodDto(changeStateRequestSchema) {}
export class UpdateSurfaceObjectDto extends createZodDto(updateSurfaceObjectRequestSchema) {}
export class DeleteSurfaceObjectQueryDto extends createZodDto(deleteSurfaceObjectQuerySchema) {}
export class SurfaceObjectResponseDto extends createZodDto(surfaceObjectSchema) {}
export class SurfaceSnapshotResponseDto extends createZodDto(surfaceSnapshotSchema) {}
export class KindPolicyResponseDto extends createZodDto(kindPolicySchema) {}
