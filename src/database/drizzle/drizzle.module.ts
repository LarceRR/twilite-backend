import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ConfigModule } from '@/config/config.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';
import * as schema from '@/database/schema';

export type Database = PostgresJsDatabase<typeof schema>;

export const DATABASE = Symbol('DATABASE');
const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

type PostgresClient = ReturnType<typeof postgres>;

/**
 * A single pool for the process. Repositories receive `DATABASE`; nothing else
 * knows the driver, which is what keeps the ORM out of the use cases.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): PostgresClient =>
        postgres(config.database.url, {
          max: config.database.poolMax,
          // Prepared statements are disabled so the app also works behind
          // transaction-mode poolers (pgBouncer, Supabase).
          prepare: false,
          onnotice: () => undefined,
        }),
    },
    {
      provide: DATABASE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: PostgresClient): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DATABASE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: PostgresClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
