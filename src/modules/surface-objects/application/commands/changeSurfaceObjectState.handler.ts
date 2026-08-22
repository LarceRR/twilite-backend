import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { NotFoundError } from '@/shared/errors';
import {
  domainEventNames,
  type SurfaceObjectStateChangedEvent,
} from '@/shared/events/domainEvents';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import {
  applyTransition,
  assertVersion,
  type SurfaceObject,
  type SurfaceObjectId,
} from '../../domain/entities/SurfaceObject';
import {
  SURFACE_OBJECT_REPOSITORY,
  type SurfaceObjectRepository,
} from '../../domain/repositories/SurfaceObjectRepository';
import type { SurfaceObjectTransition } from '../../domain/value-objects/SurfaceObjectState';
import { toSurfaceObjectDto } from '../mappers/surfaceObject.mapper';

export type ChangeStateCommand = {
  readonly objectId: SurfaceObjectId;
  /** Null when the scheduler ages an object rather than a person acting. */
  readonly actorUserId: UserId | null;
  readonly transition: SurfaceObjectTransition;
  readonly expectedVersion: number;
};

/**
 * The shared-space flow verbatim: resolve, check permission, load with version,
 * apply the domain change, persist, publish.
 */
@Injectable()
export class ChangeSurfaceObjectStateHandler {
  constructor(
    @Inject(SURFACE_OBJECT_REPOSITORY) private readonly objects: SurfaceObjectRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly access: SpaceAccessService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: ChangeStateCommand): Promise<SurfaceObject> {
    const current = await this.requireObject(command.objectId);

    if (command.actorUserId !== null) {
      await this.access.assertPermission(
        current.spaceId,
        command.actorUserId,
        'surfaceObject.changeState',
      );
    }

    assertVersion(current, command.expectedVersion);

    const changed = applyTransition(current, command.transition, this.clock.now());
    const saved = await this.objects.update(changed, command.expectedVersion);

    await this.access.invalidate(saved.spaceId);

    this.events.emit(domainEventNames.surfaceObjectStateChanged, {
      spaceId: saved.spaceId,
      actorUserId: command.actorUserId,
      transition: command.transition,
      object: toSurfaceObjectDto(saved),
    } satisfies SurfaceObjectStateChangedEvent);

    return saved;
  }

  private async requireObject(id: SurfaceObjectId): Promise<SurfaceObject> {
    const object = await this.objects.findById(id);

    if (object === null) {
      throw new NotFoundError('Объект не найден', { objectId: id });
    }

    return object;
  }
}
