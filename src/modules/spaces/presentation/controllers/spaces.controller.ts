import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/modules/users/domain/repositories/UserRepository';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { InvitationDto, SpaceDto } from '@/shared/contracts/space.contract';
import {
  type AuthenticatedUser,
  CurrentUser,
  RequirePermission,
} from '@/shared/decorators/auth.decorators';
import { NotFoundError } from '@/shared/errors';

import { CreateSpaceHandler } from '../../application/commands/createSpace.handler';
import { InviteMemberHandler } from '../../application/commands/inviteMember.handler';
import { RespondToInvitationHandler } from '../../application/commands/respondToInvitation.handler';
import { ListSpacesHandler } from '../../application/queries/listSpaces.handler';
import { SpaceAccessService } from '../../application/services/spaceAccess.service';
import type { InvitationId } from '../../domain/entities/Invitation';
import type { SpaceId } from '../../domain/value-objects/SpacePermission';
import {
  CreateSpaceDto,
  InvitationResponseDto,
  InviteMemberDto,
  RespondInvitationDto,
  SpaceResponseDto,
} from '../dto/space.dto';
import { type MemberProfile, toInvitationDto, toSpaceDto } from '../mappers/space.mapper';

@ApiTags('spaces')
@Controller('spaces')
export class SpacesController {
  constructor(
    private readonly listSpaces: ListSpacesHandler,
    private readonly createSpaceHandler: CreateSpaceHandler,
    private readonly inviteMember: InviteMemberHandler,
    private readonly respondToInvitation: RespondToInvitationHandler,
    private readonly access: SpaceAccessService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Пространства пользователя' })
  @ApiOkResponse({ type: SpaceResponseDto, isArray: true })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<readonly SpaceDto[]> {
    const spaces = await this.listSpaces.execute(user.userId);
    const profiles = await this.loadProfiles(
      spaces.flatMap((space) => space.members.map((member) => member.userId)),
    );
    return spaces.map((space) => toSpaceDto(space, profiles));
  }

  @Post()
  @ApiOperation({ summary: 'Создать общее пространство' })
  @ApiOkResponse({ type: SpaceResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateSpaceDto,
  ): Promise<SpaceDto> {
    const space = await this.createSpaceHandler.execute({
      ownerId: user.userId,
      title: body.title,
      type: body.type,
      idempotencyKey: idempotencyKey ?? null,
    });
    return toSpaceDto(space, await this.loadProfiles([user.userId]));
  }

  @Get(':spaceId')
  @RequirePermission('space.view')
  @ApiOperation({ summary: 'Пространство по идентификатору' })
  @ApiOkResponse({ type: SpaceResponseDto })
  async byId(@Param('spaceId') spaceId: string): Promise<SpaceDto> {
    const space = await this.access.requireSpace(spaceId as SpaceId);
    return toSpaceDto(space, await this.loadProfiles(space.members.map((m) => m.userId)));
  }

  @Post(':spaceId/invitations')
  @RequirePermission('space.invite')
  @ApiOperation({ summary: 'Пригласить участника по почте' })
  @ApiOkResponse({ type: InvitationResponseDto })
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('spaceId') spaceId: string,
    @Body() body: InviteMemberDto,
  ): Promise<InvitationDto> {
    const invitation = await this.inviteMember.execute({
      spaceId: spaceId as SpaceId,
      invitedByUserId: user.userId,
      email: body.email,
      permissions: body.permissions ?? null,
      idempotencyKey: idempotencyKey ?? null,
    });
    const space = await this.access.requireSpace(invitation.spaceId);
    return toInvitationDto(invitation, space.title);
  }

  @Get('invitations/pending')
  @ApiOperation({ summary: 'Приглашения, ожидающие ответа' })
  @ApiOkResponse({ type: InvitationResponseDto, isArray: true })
  async pending(@CurrentUser() user: AuthenticatedUser): Promise<readonly InvitationDto[]> {
    const profile = await this.users.findById(user.userId);
    if (profile === null) throw new NotFoundError('Пользователь не найден');
    const invitations = await this.listSpaces.listInvitations(user.userId, profile.email);
    return Promise.all(
      invitations.map(async (invitation) => {
        const space = await this.access.requireSpace(invitation.spaceId);
        return toInvitationDto(invitation, space.title);
      }),
    );
  }

  @Post('invitations/:invitationId/respond')
  @ApiOperation({ summary: 'Принять или отклонить приглашение' })
  @ApiOkResponse({ type: InvitationResponseDto })
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('invitationId') invitationId: string,
    @Body() body: RespondInvitationDto,
  ): Promise<InvitationDto> {
    const invitation = await this.respondToInvitation.execute({
      invitationId: invitationId as InvitationId,
      userId: user.userId,
      accept: body.accept,
      idempotencyKey: idempotencyKey ?? null,
    });
    const space = await this.access.requireSpace(invitation.spaceId);
    return toInvitationDto(invitation, space.title);
  }

  private async loadProfiles(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, MemberProfile>> {
    const unique = [...new Set(userIds)];
    const entries = await Promise.all(
      unique.map(async (id) => {
        const user = await this.users.findById(id);
        return [
          id,
          { displayName: user?.displayName ?? 'Участник', avatarUrl: user?.avatarUrl ?? null },
        ] as const;
      }),
    );
    return new Map(entries);
  }
}
