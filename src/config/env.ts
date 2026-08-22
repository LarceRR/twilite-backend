import { z } from 'zod';

// Первым делом: `.env` должен оказаться в process.env до того, как его кто-то прочитает.
import { loadedEnvFiles } from './load-env';

const secondsFromString = z.coerce.number().int().positive();

/**
 * The process refuses to start on a bad environment: a missing secret must fail at
 * boot, not on the first request that needs it.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().default(''),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: secondsFromString.default(900),
  JWT_REFRESH_TTL: secondsFromString.default(2_592_000),

  STORAGE_ENDPOINT: z.string().default(''),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().default(''),
  STORAGE_ACCESS_KEY_ID: z.string().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
  STORAGE_PUBLIC_URL: z.string().default(''),

  AI_PROVIDER_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('gpt-4o-mini'),

  BILLING_WEBHOOK_SECRET: z.string().default(''),

  SENTRY_DSN: z.string().default(''),

  SURFACE_SPAWN_RADIUS: z.coerce.number().int().min(1).max(8).default(2),
  SURFACE_AGE_AFTER_HOURS: z.coerce.number().int().min(1).default(72),
});

export type RawEnv = z.infer<typeof envSchema>;

export type AppConfig = {
  readonly app: {
    readonly env: RawEnv['NODE_ENV'];
    readonly isProduction: boolean;
    readonly port: number;
    readonly host: string;
    readonly logLevel: RawEnv['LOG_LEVEL'];
    readonly corsOrigins: readonly string[];
  };
  readonly database: {
    readonly url: string;
    readonly poolMax: number;
  };
  readonly redis: {
    readonly url: string;
  };
  readonly auth: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlSeconds: number;
  };
  readonly storage: {
    readonly enabled: boolean;
    readonly endpoint: string;
    readonly region: string;
    readonly bucket: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly publicUrl: string;
  };
  readonly ai: {
    readonly enabled: boolean;
    readonly apiKey: string;
    readonly model: string;
  };
  readonly billing: {
    readonly webhookSecret: string;
  };
  readonly sentry: {
    readonly dsn: string;
  };
  readonly surface: {
    readonly spawnRadius: number;
    readonly ageAfterHours: number;
  };
};

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);

  // Ошибка конфигурации показывает только имена переменных и причину: значения
  // окружения (секреты, строки подключения) в лог не попадают никогда.
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');

    throw new Error(`Некорректная конфигурация окружения:\n  ${details}\n\n${envSourceHint()}`);
  }

  const env = parsed.data;

  return {
    app: {
      env: env.NODE_ENV,
      isProduction: env.NODE_ENV === 'production',
      port: env.PORT,
      host: env.HOST,
      logLevel: env.LOG_LEVEL,
      corsOrigins: env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
    database: { url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX },
    redis: { url: env.REDIS_URL },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL,
      refreshTtlSeconds: env.JWT_REFRESH_TTL,
    },
    storage: {
      enabled: env.STORAGE_BUCKET.length > 0 && env.STORAGE_ENDPOINT.length > 0,
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      publicUrl: env.STORAGE_PUBLIC_URL,
    },
    ai: {
      enabled: env.AI_PROVIDER_API_KEY.length > 0,
      apiKey: env.AI_PROVIDER_API_KEY,
      model: env.AI_MODEL,
    },
    billing: { webhookSecret: env.BILLING_WEBHOOK_SECRET },
    sentry: { dsn: env.SENTRY_DSN },
    surface: {
      spawnRadius: env.SURFACE_SPAWN_RADIUS,
      ageAfterHours: env.SURFACE_AGE_AFTER_HOURS,
    },
  };
}

/** Самая частая причина падения на старте — не найденный .env. Скажем об этом прямо. */
function envSourceHint(): string {
  if (loadedEnvFiles.length > 0) {
    return `Прочитаны env-файлы: ${loadedEnvFiles.join(', ')}`;
  }

  return [
    'Файл .env не найден — использованы только переменные процесса.',
    'Создайте backend/.env: `copy .env.example .env` (Windows) или `cp .env.example .env`.',
  ].join('\n');
}
