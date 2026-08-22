import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Logger } from 'nestjs-pino';
import { queueNames } from '@/infrastructure/queue/queue.constants';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/modules/auth/domain/repositories/SessionRepository';
import { CLOCK, type Clock } from '@/shared/utils/clock';

/** Expired sessions are rows nobody will ever read again. */
@Processor(queueNames.cleanup)
export class CleanupProcessor extends WorkerHost {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly logger: Logger,
  ) {
    super();
  }

  override async process(_job: Job): Promise<{ removed: number }> {
    const removed = await this.sessions.deleteExpired(this.clock.now());

    if (removed > 0) {
      this.logger.log({ removed }, 'Удалены истёкшие сессии');
    }

    return { removed };
  }
}
