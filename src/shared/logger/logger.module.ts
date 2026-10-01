import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';

import { ConfigModule } from '@/config/config.module';
import { APP_CONFIG, type AppConfig } from '@/config/env';

const REDACTED = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.refreshToken',
  'req.body.pollToken',
  'req.body.token',
  'req.body.accessToken',
  'res.headers["set-cookie"]',
];

function requestLine(req: IncomingMessage, res: ServerResponse, responseTime?: number): string {
  const method = req.method ?? '?';
  const url = req.url ?? '/';
  const status = res.statusCode;
  const timing = responseTime === undefined ? '' : ` +${Math.round(responseTime)}ms`;

  return `${method} ${url} → ${status}${timing}`;
}

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
          customLogLevel: (_req, res, error) => {
            if (error !== undefined || res.statusCode >= 500) {
              return 'error';
            }

            if (res.statusCode >= 400) {
              return 'warn';
            }

            return 'info';
          },
          customSuccessMessage: (req, res, responseTime) => requestLine(req, res, responseTime),
          customErrorMessage: (req, res, error) => `${requestLine(req, res)} — ${error.message}`,
          ...(config.app.isProduction
            ? {}
            : {
                transport: {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname,req,res,responseTime',
                    messageFormat: '{msg}',
                    singleLine: true,
                  },
                },
              }),
        },
      }),
    }),
  ],
})
export class LoggerModule {}
