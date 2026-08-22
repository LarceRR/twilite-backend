import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { ConfigModule } from '@/config/config.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';
const REDACTED = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
];
@Module({
  imports: [
    PinoModule.forRootAsync({
      imports: [ConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.app.logLevel,
          genReqId: (req, res) => {
            const header = req.headers['x-request-id'];
            const id = typeof header === 'string' && header.length > 0 ? header : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: { paths: REDACTED, censor: '[redacted]' },
          autoLogging: { ignore: (req) => req.url === '/health' },
          ...(config.app.isProduction
            ? {}
            : {
                transport: {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: false,
                    translateTime: 'SYS:standard',
                    messageFormat: '{msg}',
                  },
                },
              }),
        },
      }),
    }),
  ],
})
export class LoggerModule {}
