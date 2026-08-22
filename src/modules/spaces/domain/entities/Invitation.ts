import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import type { Brand } from '@/shared/types/Brand';
import type { SpaceId, SpacePermission } from '../value-objects/SpacePermission';

export type InvitationId = Brand<string, 'InvitationId'>;

export type InvitationStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Revoked';

export type Invitation = {
  readonly id: InvitationId;
  readonly spaceId: SpaceId;
  readonly invitedByUserId: UserId;
  readonly inviteeEmail: string;
  readonly inviteeUserId: UserId | null;
  readonly permissions: readonly SpacePermission[];
  readonly status: InvitationStatus;
  readonly createdAt: Date;
  readonly respondedAt: Date | null;
};

const ALLOWED_TRANSITIONS: Readonly<Record<InvitationStatus, readonly InvitationStatus[]>> = {
  Pending: ['Accepted', 'Rejected', 'Revoked'],
  Accepted: [],
  Rejected: [],
  Revoked: [],
};

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}
