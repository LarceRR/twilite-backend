import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';

import { R2Storage } from './r2Storage';
import { STORAGE } from './StoragePort';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new R2Storage(config.storage),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
