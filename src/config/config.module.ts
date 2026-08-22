import { Global, Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig, loadConfig } from './env';
import { LIMITS, type AppLimits, loadLimits } from './limits';

/**
 * Config is resolved once and shared. Modules inject `APP_CONFIG` rather than
 * reading `process.env`, which keeps them testable.
 *
 * Лимиты (#38) живут отдельным провайдером `LIMITS`: они настраиваются
 * окружением и обязаны быть доступны любому модулю, который принимает
 * пользовательский ввод, чтобы ни одно ограничение не осталось клиентской
 * константой.
 */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig() },
    { provide: LIMITS, useFactory: (): AppLimits => loadLimits() },
  ],
  exports: [APP_CONFIG, LIMITS],
})
export class ConfigModule {}
