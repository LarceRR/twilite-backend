import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';

import { defaultJobOptions, queueNames } from './queue.constants';

const queues = Object.values(queueNames).map((name) => ({ name }));

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.redis.url },
        defaultJobOptions,
      }),
    }),
    BullModule.registerQueue(...queues),
  ],
  exports: [BullModule],
})
export class QueueModule {}
