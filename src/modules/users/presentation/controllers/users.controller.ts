import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { UserProfileResponseDto } from '@/modules/auth/presentation/dto/auth.dto';
import { UserRbacService } from '@/modules/rbac/application/services/rbacAdmin.services';
import type { UserProfileDto } from '@/shared/contracts/auth.contract';
import {
  createAvatarUploadRequestSchema,
  type UploadTicketDto,
  uploadTicketSchema,
} from '@/shared/contracts/media.contract';
import { type AuthenticatedUser, CurrentUser } from '@/shared/decorators/auth.decorators';

import { AvatarService } from '../../application/avatar.service';
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
class CreateAvatarUploadDto extends createZodDto(createAvatarUploadRequestSchema) {}
class UploadTicketResponseDto extends createZodDto(uploadTicketSchema) {}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly rbac: UserRbacService,
    private readonly avatars: AvatarService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Профиль текущего пользователя' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    const profile = await this.users.findById(user.userId);

    if (profile === null) {
      throw new NotFoundException('Пользователь не найден');
    }

    const extras = await this.rbac.getProfileExtras(user.userId);
    return toProfileDto(profile, extras);
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

    const extras = await this.rbac.getProfileExtras(user.userId);
    return toProfileDto(updated, extras);
  }

  @Get(':id/avatar')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Аватар пользователя через API' })
  async avatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const file = await this.avatars.read(id);
    reply.header('Cache-Control', 'private, max-age=300');
    return new StreamableFile(file.body, {
      type: file.contentType,
      length: file.body.length,
    });
  }

  @Post('me/avatar')
  @ApiOperation({
    summary: 'Создать загрузку аватара',
    description:
      'Клиент отправляет байты PUT на uploadUrl этого API, затем вызывает POST /users/me/avatar/:assetId/confirm.',
  })
  @ApiOkResponse({ type: UploadTicketResponseDto })
  async createAvatarUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAvatarUploadDto,
  ): Promise<UploadTicketDto> {
    return this.avatars.createUpload(user.userId, body);
  }

  @Post('me/avatar/:assetId/confirm')
  @ApiOperation({ summary: 'Подтвердить загрузку аватара и обновить профиль' })
  @ApiOkResponse({ type: UserProfileResponseDto })
  async confirmAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assetId') assetId: string,
  ): Promise<UserProfileDto> {
    const { user: profile } = await this.avatars.confirm(user.userId, assetId);
    const extras = await this.rbac.getProfileExtras(user.userId);
    return toProfileDto(profile, extras);
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

    const updated = await this.users.updatePreferences(user.userId, {
      locale: body.locale ?? current.preferences.locale,
      soundEnabled: body.soundEnabled ?? current.preferences.soundEnabled,
      hapticsEnabled: body.hapticsEnabled ?? current.preferences.hapticsEnabled,
      reduceMotion: body.reduceMotion ?? current.preferences.reduceMotion,
      pushEnabled: body.pushEnabled ?? current.preferences.pushEnabled,
    });

    const extras = await this.rbac.getProfileExtras(user.userId);
    return toProfileDto(updated, extras);
  }
}

function toProfileDto(
  user: User,
  extras: { groups: { id: string; name: string }[]; permissions: string[] },
): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    preferences: user.preferences,
    groups: extras.groups,
    permissions: extras.permissions,
  };
}
