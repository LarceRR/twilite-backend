import { Body, Controller, Get, Inject, NotFoundException, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserProfileResponseDto } from '@/modules/auth/presentation/dto/auth.dto';
import type { UserProfileDto } from '@/shared/contracts/auth.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';
import type { User } from '../../domain/entities/User';
import { USER_REPOSITORY, type UserRepository } from '../../domain/repositories/UserRepository';

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().nullish(),
});

const updatePreferencesSchema = z.object({
  locale: z.string().min(2).max(10).optional(),
  soundEnabled: z.boolean().optional(),
  hapticsEnabled: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
class UpdatePreferencesDto extends createZodDto(updatePreferencesSchema) {}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  @Get('me')
  @ApiOperation({ summary: 'Профиль текущего пользователя' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    const profile = await this.users.findById(user.userId);

    if (profile === null) {
      throw new NotFoundException('Пользователь не найден');
    }

    return toProfileDto(profile);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновить профиль' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const updated = await this.users.updateProfile(user.userId, {
      ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
      ...(body.avatarUrl === undefined ? {} : { avatarUrl: body.avatarUrl ?? null }),
    });

    return toProfileDto(updated);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Обновить настройки' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdatePreferencesDto,
  ): Promise<UserProfileDto> {
    const current = await this.users.findById(user.userId);

    if (current === null) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Preferences are stored as a whole row, so unspecified fields keep their value.
    const updated = await this.users.updatePreferences(user.userId, {
      locale: body.locale ?? current.preferences.locale,
      soundEnabled: body.soundEnabled ?? current.preferences.soundEnabled,
      hapticsEnabled: body.hapticsEnabled ?? current.preferences.hapticsEnabled,
      reduceMotion: body.reduceMotion ?? current.preferences.reduceMotion,
      pushEnabled: body.pushEnabled ?? current.preferences.pushEnabled,
    });

    return toProfileDto(updated);
  }
}

function toProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    preferences: user.preferences,
  };
}
