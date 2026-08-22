import 'reflect-metadata';
import { stdout, stderr } from 'node:process';
import '@/config/load-env';
import { createApp } from '@/bootstrap/createApp';
import { loadConfig } from '@/config/env';
import { initSentry } from '@/infrastructure/sentry/sentry';
async function bootstrap(): Promise<void> {
  stdout.setDefaultEncoding('utf8');
  stderr.setDefaultEncoding('utf8');
  const config = loadConfig();
  initSentry(config);
  const { app } = await createApp();
  await app.listen({ port: config.app.port, host: config.app.host });
}
bootstrap().catch((error: unknown) => {
  console.error('Не удалось запустить сервер', error);
  process.exit(1);
});
