import { createZodDto } from 'nestjs-zod';

import {
  authSessionSchema,
  refreshRequestSchema,
  sessionSchema,
  signInRequestSchema,
  signUpRequestSchema,
  userProfileSchema,
} from '@/shared/contracts/auth.contract';

/**
 * DTO classes exist only so Nest can validate and document a route; the schema in
 * `shared/contracts` stays the single definition.
 */
export class SignUpDto extends createZodDto(signUpRequestSchema) {}
export class SignInDto extends createZodDto(signInRequestSchema) {}
export class RefreshDto extends createZodDto(refreshRequestSchema) {}
export class AuthSessionResponseDto extends createZodDto(authSessionSchema) {}
export class UserProfileResponseDto extends createZodDto(userProfileSchema) {}
export class SessionResponseDto extends createZodDto(sessionSchema) {}
