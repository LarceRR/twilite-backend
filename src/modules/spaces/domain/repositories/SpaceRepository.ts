import type { UserId } from '@/modules/users/domain/value-objects/UserId';

import type { Invitation, InvitationId, InvitationStatus } from '../entities/Invitation';
import type { Space, SpaceMember } from '../entities/Space';
import type { SpaceId, SpacePermission, SpaceType } from '../value-objects/SpacePermission';

export type CreateSpaceInput = {
  readonly type: SpaceType;
  readonly title: string;
  readonly ownerId: UserId;
};

export type CreateInvitationInput = {
  readonly spaceId: SpaceId;
  readonly invitedByUserId: UserId;
  readonly inviteeEmail: string;
  readonly inviteeUserId: UserId | null;
  readonly permissions: readonly SpacePermission[];
};

/**
 * A port, owned by the domain. Adapters (Drizzle today, anything later) implement
 * it; use cases never see SQL.
 */
export interface SpaceRepository {
  findById(id: SpaceId): Promise<Space | null>;
  listForUser(userId: UserId): Promise<readonly Space[]>;
  findPersonalSpace(userId: UserId): Promise<Space | null>;
  create(input: CreateSpaceInput): Promise<Space>;
  addMember(spaceId: SpaceId, member: SpaceMember, expectedVersion: number): Promise<Space>;
  removeMember(spaceId: SpaceId, userId: UserId, expectedVersion: number): Promise<Space>;

  createInvitation(input: CreateInvitationInput): Promise<Invitation>;
  findInvitationById(id: InvitationId): Promise<Invitation | null>;
  listInvitationsForUser(userId: UserId, email: string): Promise<readonly Invitation[]>;
  setInvitationStatus(id: InvitationId, status: InvitationStatus): Promise<Invitation>;
}

export const SPACE_REPOSITORY = Symbol('SPACE_REPOSITORY');
