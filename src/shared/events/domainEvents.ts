import type { SurfaceObjectDto } from '@/shared/contracts/surface.contract';
import type { TimelineEventDto } from '@/shared/contracts/timeline.contract';

/**
 * Modules talk to each other only through these events. That is what allows the
 * timeline, notifications, AI and realtime layers to react to the surface without
 * the surface module knowing they exist.
 */
export const domainEventNames = {
  surfaceObjectCreated: 'surfaceObject.created',
  surfaceObjectStateChanged: 'surfaceObject.stateChanged',
  surfaceObjectUpdated: 'surfaceObject.updated',
  surfaceObjectDeleted: 'surfaceObject.deleted',
  spaceCreated: 'space.created',
  spaceMemberJoined: 'space.memberJoined',
  invitationCreated: 'invitation.created',
  timelineAppended: 'timeline.appended',
  entitlementsChanged: 'billing.entitlementsChanged',
} as const;

export type SurfaceObjectCreatedEvent = {
  readonly spaceId: string;
  readonly actorUserId: string;
  readonly object: SurfaceObjectDto;
};

export type SurfaceObjectStateChangedEvent = {
  readonly spaceId: string;
  readonly actorUserId: string | null;
  readonly transition: 'activate' | 'soften' | 'age';
  readonly object: SurfaceObjectDto;
};

export type SurfaceObjectUpdatedEvent = {
  readonly spaceId: string;
  readonly actorUserId: string;
  readonly object: SurfaceObjectDto;
};

export type SurfaceObjectDeletedEvent = {
  readonly spaceId: string;
  readonly actorUserId: string;
  readonly objectId: string;
  readonly kind: string;
};

export type SpaceCreatedEvent = {
  readonly spaceId: string;
  readonly ownerId: string;
  readonly type: 'Personal' | 'Shared';
};

export type SpaceMemberJoinedEvent = {
  readonly spaceId: string;
  readonly userId: string;
};

export type InvitationCreatedEvent = {
  readonly spaceId: string;
  readonly invitationId: string;
  readonly inviteeEmail: string;
  readonly inviteeUserId: string | null;
};

export type TimelineAppendedEvent = {
  readonly spaceId: string;
  readonly event: TimelineEventDto;
};

export type EntitlementsChangedEvent = {
  readonly userId: string;
};
