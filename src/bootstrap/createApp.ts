import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from 'nestjs-pino';

import { AppModule } from '@/app/app.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';

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

  app.useLogger(app.get(Logger));
  app.flushLogs();
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

  // @fastify/static is an optional peer of the Swagger/Fastify integration.
  // The API must not die before auth routes are reachable just because docs UI
  // is unavailable in the minimal production image.
  if (process.env['ENABLE_SWAGGER'] === 'true') {
    setupSwagger(app, config);
  }

  return { app, config };
}
