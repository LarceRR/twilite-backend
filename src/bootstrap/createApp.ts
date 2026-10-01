import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import type { Redis } from 'ioredis';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app/app.module';
import { assertCriticalDependencies } from '@/app/health/dependencyChecks';
import { APP_CONFIG, type AppConfig } from '@/config/env';
import { type AppLimits, LIMITS } from '@/config/limits';
import { DATABASE, type Database } from '@/database/drizzle/drizzle.module';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';

import { setupSwagger } from './swagger';

/** Fastify API bootstrap with HTTP, WebSocket and health endpoints. */
export async function createApp(): Promise<{
  app: NestFastifyApplication;
  config: AppConfig;
}> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }),
    { bufferLogs: true },
  );

  const config = app.get<AppConfig>(APP_CONFIG);
  const limits = app.get<AppLimits>(LIMITS);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.flushLogs();

  if (config.storage.enabled) {
    logger.log(
      {
        bucket: config.storage.bucket,
        endpoint: config.storage.endpoint,
        publicUrlConfigured: config.storage.publicUrl.length > 0,
      },
      'Object storage (R2) включён',
    );
  } else {
    logger.warn('Object storage выключен — задайте STORAGE_ENDPOINT и STORAGE_BUCKET в .env');
  }
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  await app.register(import('@fastify/cors'), {
    origin: config.app.corsOrigins.length === 0 ? true : [...config.app.corsOrigins],
    credentials: true,
  });

  // Multipart lets TPG accept device uploads (field `image`) without base64 JSON.
  await app.register(import('@fastify/multipart'), {
    limits: {
      files: 1,
      fileSize: limits.tpg.imageMaxBytes,
    },
  });

  // @fastify/static is an optional peer of the Swagger/Fastify integration.
  // The API must not die before auth routes are reachable just because docs UI
  // is unavailable in the minimal production image.
  if (process.env['ENABLE_SWAGGER'] === 'true') {
    setupSwagger(app, config);
  }

  // Nest creates clients without waiting; refuse to return an app that cannot
  // reach Postgres or Redis so `listen` never binds on a broken process.
  try {
    await assertCriticalDependencies(app.get<Database>(DATABASE), app.get<Redis>(REDIS_CLIENT));
  } catch (error) {
    await app.close();
    throw error;
  }

  return { app, config };
}
