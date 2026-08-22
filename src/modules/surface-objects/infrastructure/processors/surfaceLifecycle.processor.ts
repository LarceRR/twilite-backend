import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Logger } from 'nestjs-pino';

import { APP_CONFIG, type AppConfig } from '@/config/env';
import { queueNames } from '@/infrastructure/queue/queue.constants';
import { AppError } from '@/shared/errors';
import { CLOCK, type Clock } from '@/shared/utils/clock';

import { ChangeSurfaceObjectStateHandler } from '../../application/commands/changeSurfaceObjectState.handler';
import {
  SURFACE_OBJECT_REPOSITORY,
  type SurfaceObjectRepository,
} from '../../domain/repositories/SurfaceObjectRepository';

const BATCH_SIZE = 200;

/**
 * The scheduled `age` transition (Fading → Settled). It goes through the same use
 * case a user would, so the domain rules and the emitted events are identical —
 * there is no back door that mutates state directly.
 */
@Processor(queueNames.surfaceLifecycle)
export class SurfaceLifecycleProcessor extends WorkerHost {
  constructor(
    @Inject(SURFACE_OBJECT_REPOSITORY) private readonly objects: SurfaceObjectRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly changeState: ChangeSurfaceObjectStateHandler,
    private readonly logger: Logger,
  ) {
    super();
  }

  override async process(_job: Job): Promise<{ aged: number }> {
    const threshold = new Date(
      this.clock.now().getTime() - this.config.surface.ageAfterHours * 3_600_000,
    );

    const candidates = await this.objects.listFadingBefore(threshold, BATCH_SIZE);
    let aged = 0;

    for (const object of candidates) {
      try {
        await this.changeState.execute({
          objectId: object.id,
          // No actor: this is a domain rule, not someone's action.
          actorUserId: null,
          transition: 'age',
          expectedVersion: object.version,
        });
        aged += 1;
      } catch (error) {
        // A concurrent change just means this object no longer needs ageing.
        if (error instanceof AppError && error.kind === 'conflict') {
          continue;
        }

        throw error;
      }
    }

    if (aged > 0) {
      this.logger.log({ aged }, 'Объекты переведены в Settled');
    }

    return { aged };
  }
}
