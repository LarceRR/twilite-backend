import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { jobNames, queueNames } from '../queue.constants';
const HOURLY = { pattern: '0 * * * *' } as const;
const DAILY = { pattern: '15 3 * * *' } as const;
@Injectable()
export class RecurringJobs implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(queueNames.surfaceLifecycle) private readonly lifecycle: Queue,
    @InjectQueue(queueNames.cleanup) private readonly cleanup: Queue,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    await this.lifecycle.add(
      jobNames.ageSurfaceObjects,
      {},
      { repeat: HOURLY, jobId: jobNames.ageSurfaceObjects },
    );
    await this.cleanup.add(
      jobNames.expireSessions,
      {},
      { repeat: DAILY, jobId: jobNames.expireSessions },
    );
  }
}
