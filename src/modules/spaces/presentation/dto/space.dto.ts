import { createZodDto } from 'nestjs-zod';

import {
  createSpaceRequestSchema,
  invitationSchema,
  inviteMemberRequestSchema,
  respondInvitationRequestSchema,
  spaceSchema,
} from '@/shared/contracts/space.contract';

export class CreateSpaceDto extends createZodDto(createSpaceRequestSchema) {}
export class InviteMemberDto extends createZodDto(inviteMemberRequestSchema) {}
export class RespondInvitationDto extends createZodDto(respondInvitationRequestSchema) {}
export class SpaceResponseDto extends createZodDto(spaceSchema) {}
export class InvitationResponseDto extends createZodDto(invitationSchema) {}
