import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { analyticsEvents } from '@/database/schema';
import { queueNames } from '@/infrastructure/queue/queue.constants';

type TrackJob = {
  readonly userId: string;
  readonly name: string;
  readonly properties: Record<string, unknown>;
  readonly occurredAt?: string;
};

@Processor(queueNames.analytics)
export class AnalyticsProcessor extends WorkerHost {
  constructor(@Inject(DATABASE) private readonly db: Database) {
    super();
  }

  override async process(job: Job<TrackJob>): Promise<void> {
    const { userId, name, properties, occurredAt } = job.data;

    await this.db.insert(analyticsEvents).values({
      userId,
      name,
      properties,
      // The client timestamp is trusted only as a hint; a bad one falls back to now.
      occurredAt: parseDate(occurredAt),
    });
  }
}

function parseDate(value: string | undefined): Date {
  if (value === undefined) {
    return new Date();
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
