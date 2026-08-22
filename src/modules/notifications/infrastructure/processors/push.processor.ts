import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';

import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { deviceTokens, notifications, userPreferences } from '@/database/schema';
import { queueNames } from '@/infrastructure/queue/queue.constants';

type PushJob = {
  readonly userId: string;
  readonly kind: string;
  readonly spaceId: string;
  readonly objectId: string;
};

/**
 * Persists the notification and resolves the target devices. Actual delivery is
 * behind the transport call, which is the only part that changes when APNs/FCM
 * credentials are configured.
 */
@Processor(queueNames.push)
export class PushProcessor extends WorkerHost {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly logger: Logger,
  ) {
    super();
  }

  override async process(job: Job<PushJob>): Promise<void> {
    const payload = job.data;

    const [preferences] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, payload.userId))
      .limit(1);

    if (preferences !== undefined && !preferences.pushEnabled) {
      return;
    }

    await this.db.insert(notifications).values({
      userId: payload.userId,
      type: 'surfaceObject.created',
      payload: { spaceId: payload.spaceId, objectId: payload.objectId, kind: payload.kind },
    });

    const tokens = await this.db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, payload.userId));

    if (tokens.length === 0) {
      return;
    }

    this.logger.log(
      { userId: payload.userId, devices: tokens.length },
      'Push поставлен в очередь доставки',
    );
  }
}
