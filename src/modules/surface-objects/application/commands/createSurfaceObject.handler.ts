import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { SpaceAccessService } from '@/modules/spaces/application/services/spaceAccess.service';
import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import { SurfaceResolverService } from '@/modules/surfaces/application/services/surfaceResolver.service';
import { spawnActiveCell } from '@/modules/surfaces/domain/services/spawnActiveCell';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { ConflictError, DomainError } from '@/shared/errors';
import { ErrorCode } from '@/shared/errors/AppError';
import { domainEventNames, type SurfaceObjectCreatedEvent } from '@/shared/events/domainEvents';
import { IdempotencyService } from '@/shared/idempotency/idempotency.service';
import { RANDOM_SOURCE, type RandomSource } from '@/shared/utils/random';

import type { SurfaceObject, SurfaceObjectMetadata } from '../../domain/entities/SurfaceObject';
import {
  SURFACE_OBJECT_REPOSITORY,
  type SurfaceObjectRepository,
} from '../../domain/repositories/SurfaceObjectRepository';
import { assertSubjectAllowed, defaultSubjectUserId } from '../../domain/services/subjectPolicy';
import type { SurfaceObjectKind } from '../../domain/value-objects/SurfaceObjectKind';
import { toSurfaceObjectDto } from '../mappers/surfaceObject.mapper';
import { assertPublishedPixelObject, resolvePixelObjectIdFromCreate } from '../pixelObjectBinding';

export type CreateSurfaceObjectCommand = {
  readonly spaceId: SpaceId;
  readonly createdByUserId: UserId;
  readonly kind: SurfaceObjectKind;
  readonly subjectUserId: UserId | null;
  readonly metadata: SurfaceObjectMetadata;
  readonly pixelObjectId?: string;
  readonly idempotencyKey?: string | null;
};

const MAX_CELL_ATTEMPTS = 5;

// Placement stays implemented for later reactivation, but must not spawn objects during terrain work.
const SURFACE_OBJECT_SPAWNING_ENABLED = false;

@Injectable()
export class CreateSurfaceObjectHandler {
  constructor(
    @Inject(SURFACE_OBJECT_REPOSITORY) private readonly objects: SurfaceObjectRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(LIMITS) private readonly limits: AppLimits,
    private readonly access: SpaceAccessService,
    private readonly surfaceResolver: SurfaceResolverService,
    private readonly events: EventEmitter2,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(command: CreateSurfaceObjectCommand): Promise<SurfaceObject> {
    return this.idempotency.execute({
      key: command.idempotencyKey,
      scope: `surface-object:create:${command.createdByUserId}:${command.spaceId}`,
      payload: {
        kind: command.kind,
        subjectUserId: command.subjectUserId,
        metadata: command.metadata,
        pixelObjectId: command.pixelObjectId ?? null,
      },
      operation: () => this.create(command),
    });
  }

  private async create(command: CreateSurfaceObjectCommand): Promise<SurfaceObject> {
    this.assertMetadataBounds(command.metadata);
    const pixelObjectId = resolvePixelObjectIdFromCreate(command);
    if (pixelObjectId !== null) {
      await assertPublishedPixelObject(this.db, pixelObjectId);
    }

    const space = await this.access.assertPermission(
      command.spaceId,
      command.createdByUserId,
      'surfaceObject.create',
    );
    const subjectUserId =
      command.subjectUserId ?? defaultSubjectUserId(space, command.createdByUserId);
    assertSubjectAllowed({
      space,
      kind: command.kind,
      createdByUserId: command.createdByUserId,
      subjectUserId,
    });
    if (!SURFACE_OBJECT_SPAWNING_ENABLED) {
      throw new DomainError(
        'Размещение объектов на поверхности временно отключено',
        { feature: 'surfaceObjectSpawning' },
        { code: ErrorCode.SURFACE_OBJECT_SPAWNING_DISABLED, httpStatus: 503 },
      );
    }
    const surface = await this.surfaceResolver.resolve(space.id);
    const created = await this.insertAtFreeCell({
      surfaceId: surface.id,
      spaceId: space.id,
      command,
      subjectUserId,
      pixelObjectId,
    });
    await this.access.invalidate(space.id);
    this.events.emit(domainEventNames.surfaceObjectCreated, {
      spaceId: space.id,
      actorUserId: command.createdByUserId,
      object: toSurfaceObjectDto(created),
    } satisfies SurfaceObjectCreatedEvent);
    return created;
  }

  private assertMetadataBounds(metadata: SurfaceObjectMetadata): void {
    const keys = Object.keys(metadata);
    if (keys.length > this.limits.moments.metadataMaxKeys) {
      throw new DomainError(
        'Слишком много ключей metadata',
        { code: 'SURFACE_METADATA_TOO_LARGE' },
        { code: ErrorCode.DOMAIN_RULE_VIOLATION, httpStatus: 422 },
      );
    }
    const bytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8');
    if (bytes > this.limits.moments.metadataMaxBytes) {
      throw new DomainError(
        'metadata слишком большой',
        { code: 'SURFACE_METADATA_TOO_LARGE' },
        { code: ErrorCode.DOMAIN_RULE_VIOLATION, httpStatus: 422 },
      );
    }
  }

  private async insertAtFreeCell(params: {
    readonly surfaceId: SurfaceObject['surfaceId'];
    readonly spaceId: SpaceId;
    readonly command: CreateSurfaceObjectCommand;
    readonly subjectUserId: UserId;
    readonly pixelObjectId: string | null;
  }): Promise<SurfaceObject> {
    let lastConflict: ConflictError | null = null;

    for (let attempt = 0; attempt < MAX_CELL_ATTEMPTS; attempt += 1) {
      try {
        return await this.insertOnce(params);
      } catch (error) {
        if (error instanceof ConflictError) {
          lastConflict = error;
          continue;
        }
        throw error;
      }
    }
    throw (
      lastConflict ??
      new ConflictError('Не удалось занять ячейку на поверхности', { surfaceId: params.surfaceId })
    );
  }

  private async insertOnce(params: {
    readonly surfaceId: SurfaceObject['surfaceId'];
    readonly spaceId: SpaceId;
    readonly command: CreateSurfaceObjectCommand;
    readonly subjectUserId: UserId;
    readonly pixelObjectId: string | null;
  }): Promise<SurfaceObject> {
    const created = await this.objects.insertAtNextCell(
      {
        spaceId: params.spaceId,
        surfaceId: params.surfaceId,
        kind: params.command.kind,
        state: 'Emerging',
        createdByUserId: params.command.createdByUserId,
        subjectUserId: params.subjectUserId,
        metadata: params.command.metadata,
        pixelObjectId: params.pixelObjectId,
      },
      this.limits.moments.objectsPerSurface,
      (context) => spawnActiveCell({ ...context, random: this.random }),
    );
    if (created !== null) return created;
    throw new DomainError(
      'Поверхность заполнена',
      { code: 'SURFACE_FULL', surfaceId: params.surfaceId },
      { code: ErrorCode.DOMAIN_RULE_VIOLATION, httpStatus: 422 },
    );
  }
}
