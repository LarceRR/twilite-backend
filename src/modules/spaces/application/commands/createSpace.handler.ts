import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EntitlementsService } from '@/modules/billing/application/services/entitlements.service';
import {
  SURFACE_REPOSITORY,
  type SurfaceRepository,
} from '@/modules/surfaces/domain/repositories/SurfaceRepository';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';
import { domainEventNames, type SpaceCreatedEvent } from '@/shared/events/domainEvents';

import type { Space } from '../../domain/entities/Space';
import { SPACE_REPOSITORY, type SpaceRepository } from '../../domain/repositories/SpaceRepository';
import type { SpaceType } from '../../domain/value-objects/SpacePermission';
import { SpaceAccessService } from '../services/spaceAccess.service';

export type CreateSpaceCommand = {
  readonly ownerId: UserId;
  readonly title: string;
  readonly type: SpaceType;
  readonly idempotencyKey?: string | null;
};

/** A space is never useful without its surface, so both are created here. */
@Injectable()
export class CreateSpaceHandler {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepository,
    @Inject(SURFACE_REPOSITORY) private readonly surfaces: SurfaceRepository,
    private readonly entitlements: EntitlementsService,
    private readonly access: SpaceAccessService,
    private readonly events: EventEmitter2,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(command: CreateSpaceCommand): Promise<Space> {
    return this.idempotency.execute({
      key: command.idempotencyKey,
      scope: `space:create:${command.ownerId}`,
      payload: { title: command.title.trim(), type: command.type },
      operation: () => this.create(command),
    });
  }

  private async create(command: CreateSpaceCommand): Promise<Space> {
    if (command.type === 'Shared') {
      await this.entitlements.assertGranted(command.ownerId, 'canCreateMultipleSpaces');
    }

    const space = await this.spaces.create({
      type: command.type,
      title: command.title.trim(),
      ownerId: command.ownerId,
    });

    await this.surfaces.create(space.id);
    await this.access.invalidate(space.id, [command.ownerId]);

    this.events.emit(domainEventNames.spaceCreated, {
      spaceId: space.id,
      ownerId: command.ownerId,
      type: command.type,
    } satisfies SpaceCreatedEvent);

    return space;
  }
}
