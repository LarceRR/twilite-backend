import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { NotFoundError } from '@/shared/errors';
import {
  domainEventNames,
  type SurfaceObjectDeletedEvent,
  type SurfaceObjectUpdatedEvent,
} from '@/shared/events/domainEvents';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import {
  assertVersion,
  type SurfaceObject,
  type SurfaceObjectId,
  type SurfaceObjectMetadata,
  withFavorite,
  withMetadata,
} from '../../domain/entities/SurfaceObject';
import {
  SURFACE_OBJECT_REPOSITORY,
  type SurfaceObjectRepository,
} from '../../domain/repositories/SurfaceObjectRepository';
import { toSurfaceObjectDto } from '../mappers/surfaceObject.mapper';

export type UpdateSurfaceObjectCommand = {
  readonly objectId: SurfaceObjectId;
  readonly actorUserId: UserId;
  readonly metadata: SurfaceObjectMetadata | null;
  readonly favorite: boolean | null;
  readonly expectedVersion: number;
};

export type DeleteSurfaceObjectCommand = {
  readonly objectId: SurfaceObjectId;
  readonly actorUserId: UserId;
  readonly expectedVersion: number;
};

@Injectable()
export class UpdateSurfaceObjectHandler {
  constructor(
    @Inject(SURFACE_OBJECT_REPOSITORY) private readonly objects: SurfaceObjectRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: SpaceAccessService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: UpdateSurfaceObjectCommand): Promise<SurfaceObject> {
    const current = await this.requireObject(command.objectId);

    await this.access.assertPermission(
      current.spaceId,
      command.actorUserId,
      'surfaceObject.update',
    );

    assertVersion(current, command.expectedVersion);

    const now = this.clock.now();
    let next = current;

    if (command.metadata !== null) {
      next = withMetadata(next, command.metadata, now);
    }

    if (command.favorite !== null) {
      next = withFavorite(next, command.favorite, now);
    }

    // One version bump per request, whatever combination of fields changed.
    const saved = await this.objects.update(
      { ...next, version: current.version + 1 },
      command.expectedVersion,
    );

    await this.access.invalidate(saved.spaceId);

    this.events.emit(domainEventNames.surfaceObjectUpdated, {
      spaceId: saved.spaceId,
      actorUserId: command.actorUserId,
      object: toSurfaceObjectDto(saved),
    } satisfies SurfaceObjectUpdatedEvent);

    return saved;
  }

  async delete(command: DeleteSurfaceObjectCommand): Promise<void> {
    const current = await this.requireObject(command.objectId);

    await this.access.assertPermission(
      current.spaceId,
      command.actorUserId,
      'surfaceObject.delete',
    );

    await this.objects.delete(command.objectId, command.expectedVersion);
    await this.access.invalidate(current.spaceId);

    this.events.emit(domainEventNames.surfaceObjectDeleted, {
      spaceId: current.spaceId,
      actorUserId: command.actorUserId,
      objectId: command.objectId,
      kind: current.kind,
    } satisfies SurfaceObjectDeletedEvent);
  }

  private async requireObject(id: SurfaceObjectId): Promise<SurfaceObject> {
    const object = await this.objects.findById(id);

    if (object === null) {
      throw new NotFoundError('Объект не найден', { objectId: id });
    }

    return object;
  }
}
