import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Logger } from 'nestjs-pino';

import { jobNames, queueNames } from '@/infrastructure/queue/queue.constants';

import { MediaGcService } from '../../application/mediaGc.service';

@Processor(queueNames.media)
export class MediaGcProcessor extends WorkerHost {
  constructor(
    private readonly mediaGc: MediaGcService,
    private readonly logger: Logger,
  ) {
    super();
  }

  override async process(job: Job): Promise<{ pendingDeleted: number; orphanSheetsDeleted: number }> {
    if (job.name !== jobNames.gcPendingMedia) {
      this.logger.warn({ jobName: job.name }, 'media_gc_unknown_job');
      return { pendingDeleted: 0, orphanSheetsDeleted: 0 };
    }
    const report = await this.mediaGc.run({ dryRun: false });
    return {
      pendingDeleted: report.pendingDeleted,
      orphanSheetsDeleted: report.orphanSheetsDeleted,
    };
  }
}
