import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigModule } from '@/config/config.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';

import { CACHE, RedisCache } from './redisCache';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis =>
        new Redis(config.redis.url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        }),
    },
    {
      provide: CACHE,
      inject: [REDIS_CLIENT],
      useFactory: (client: Redis) => new RedisCache(client),
    },
  ],
  exports: [REDIS_CLIENT, CACHE],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
