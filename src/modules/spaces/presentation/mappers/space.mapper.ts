import type { InvitationDto, SpaceDto } from '@/shared/contracts/space.contract';

import type { Invitation } from '../../domain/entities/Invitation';
import type { Space } from '../../domain/entities/Space';

export type MemberProfile = {
  readonly displayName: string;
  readonly avatarUrl: string | null;
};

export function toSpaceDto(space: Space, profiles: ReadonlyMap<string, MemberProfile>): SpaceDto {
  return {
    id: space.id,
    type: space.type,
    title: space.title,
    ownerId: space.ownerId,
    members: space.members.map((member) => ({
      userId: member.userId,
      // A missing profile means the account was removed; the space still renders.
      displayName: profiles.get(member.userId)?.displayName ?? 'Участник',
      avatarUrl: profiles.get(member.userId)?.avatarUrl ?? null,
      role: member.role,
      permissions: [...member.permissions],
      joinedAt: member.joinedAt.toISOString(),
    })),
    createdAt: space.createdAt.toISOString(),
    version: space.version,
  };
}

export function toInvitationDto(invitation: Invitation, spaceTitle: string): InvitationDto {
  return {
    id: invitation.id,
    spaceId: invitation.spaceId,
    spaceTitle,
    invitedByUserId: invitation.invitedByUserId,
    inviteeEmail: invitation.inviteeEmail,
    permissions: [...invitation.permissions],
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    respondedAt: invitation.respondedAt?.toISOString() ?? null,
  };
}
