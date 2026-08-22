/**
 * Продуктовые и ресурсные лимиты (issue #38).
 *
 * Один реестр — единственный источник правды. Из него собирается разбор
 * окружения, типизированный объект `AppLimits` для DI и матрица в
 * `docs/limits.md`. Ни одно значение не является клиентской константой: клиент
 * может показать подсказку, но решение всегда принимает бэкенд.
 *
 * Значение задаётся env-ключом, поэтому его можно менять без релиза. Пустое или
 * нецелое значение — ошибка старта, а не тихий фолбэк на дефолт.
 */

export type LimitUnit =
  | 'characters'
  | 'bytes'
  | 'items'
  | 'seconds'
  | 'hours'
  | 'milliseconds'
  | 'requests/minute'
  | 'requests/hour'
  | 'requests/day'
  | 'usd cents/day';

export type LimitDefinition = {
  /** Ключ окружения. Меняется без пересборки клиента. */
  readonly key: string;
  /** Путь в объекте `AppLimits`. */
  readonly path: string;
  readonly unit: LimitUnit;
  /** Значение для production. Оно же дефолт, если ключ не задан. */
  readonly production: number;
  readonly min: number;
  readonly max: number;
  /** Модуль бэкенда, который обязан применить лимит. */
  readonly owner: string;
  readonly description: string;
};

export const LIMIT_DEFINITIONS: readonly LimitDefinition[] = [
  // Аутентификация и профиль
  {
    key: 'LIMIT_EMAIL_MAX_LENGTH',
    path: 'auth.emailMaxLength',
    unit: 'characters',
    production: 254,
    min: 32,
    max: 320,
    owner: 'auth',
    description: 'Максимальная длина email при регистрации и входе',
  },
  {
    key: 'LIMIT_PASSWORD_MIN_LENGTH',
    path: 'auth.passwordMinLength',
    unit: 'characters',
    production: 8,
    min: 8,
    max: 64,
    owner: 'auth',
    description: 'Минимальная длина пароля; совпадает с текущим auth.contract',
  },
  {
    key: 'LIMIT_PASSWORD_MAX_LENGTH',
    path: 'auth.passwordMaxLength',
    unit: 'characters',
    production: 128,
    min: 64,
    max: 256,
    owner: 'auth',
    description: 'Максимальная длина пароля: защита от дорогого хеширования',
  },
  {
    key: 'LIMIT_DISPLAY_NAME_MAX_LENGTH',
    path: 'auth.displayNameMaxLength',
    unit: 'characters',
    production: 80,
    min: 8,
    max: 200,
    owner: 'auth',
    description: 'Максимальная длина отображаемого имени',
  },
  {
    key: 'LIMIT_ACTIVE_SESSIONS_PER_USER',
    path: 'auth.activeSessionsPerUser',
    unit: 'items',
    production: 10,
    min: 1,
    max: 100,
    owner: 'auth',
    description: 'Одновременные активные сессии на пользователя',
  },
  {
    key: 'LIMIT_SIGN_IN_ATTEMPTS_PER_HOUR',
    path: 'auth.signInAttemptsPerHour',
    unit: 'requests/hour',
    production: 20,
    min: 3,
    max: 1000,
    owner: 'auth',
    description: 'Попытки входа на аккаунт в час',
  },
  {
    key: 'LIMIT_SIGN_UP_PER_IP_PER_HOUR',
    path: 'auth.signUpPerIpPerHour',
    unit: 'requests/hour',
    production: 5,
    min: 1,
    max: 1000,
    owner: 'auth',
    description: 'Регистрации с одного адреса в час',
  },
  {
    key: 'LIMIT_PASSWORD_RESET_PER_EMAIL_PER_HOUR',
    path: 'auth.passwordResetPerEmailPerHour',
    unit: 'requests/hour',
    production: 3,
    min: 1,
    max: 100,
    owner: 'auth',
    description: 'Запросы восстановления доступа на email в час',
  },

  // Пространства
  {
    key: 'LIMIT_SPACES_PER_USER',
    path: 'spaces.spacesPerUser',
    unit: 'items',
    production: 3,
    min: 1,
    max: 50,
    owner: 'spaces',
    description: 'Пространства, которыми пользователь владеет',
  },
  {
    key: 'LIMIT_SPACE_TITLE_MAX_LENGTH',
    path: 'spaces.titleMaxLength',
    unit: 'characters',
    production: 80,
    min: 8,
    max: 200,
    owner: 'spaces',
    description: 'Максимальная длина названия пространства',
  },
  {
    key: 'LIMIT_MEMBERS_PER_SPACE',
    path: 'spaces.membersPerSpace',
    unit: 'items',
    production: 2,
    min: 2,
    max: 10,
    owner: 'spaces',
    description: 'Участники одного пространства; MVP — пара',
  },

  // Приглашения
  {
    key: 'LIMIT_PENDING_INVITATIONS_PER_SPACE',
    path: 'invitations.pendingPerSpace',
    unit: 'items',
    production: 1,
    min: 1,
    max: 10,
    owner: 'spaces',
    description:
      'Активные приглашения на пространство; совпадает с частичным индексом invitations_pending_unique',
  },
  {
    key: 'LIMIT_INVITATIONS_PER_USER_PER_DAY',
    path: 'invitations.perUserPerDay',
    unit: 'requests/day',
    production: 20,
    min: 1,
    max: 500,
    owner: 'spaces',
    description: 'Приглашения, отправленные пользователем за сутки',
  },
  {
    key: 'LIMIT_INVITATION_TTL_HOURS',
    path: 'invitations.ttlHours',
    unit: 'hours',
    production: 72,
    min: 1,
    max: 720,
    owner: 'spaces',
    description: 'Срок жизни приглашения до перехода в expired',
  },

  // Моменты и поверхность
  {
    key: 'LIMIT_MOMENT_TEXT_MAX_LENGTH',
    path: 'moments.textMaxLength',
    unit: 'characters',
    production: 2000,
    min: 100,
    max: 20000,
    owner: 'surface-objects',
    description: 'Длина пользовательского текста момента',
  },
  {
    key: 'LIMIT_MOMENT_METADATA_MAX_BYTES',
    path: 'moments.metadataMaxBytes',
    unit: 'bytes',
    production: 8192,
    min: 512,
    max: 262144,
    owner: 'surface-objects',
    description: 'Размер metadata момента в JSON',
  },
  {
    key: 'LIMIT_MOMENT_METADATA_MAX_KEYS',
    path: 'moments.metadataMaxKeys',
    unit: 'items',
    production: 32,
    min: 4,
    max: 200,
    owner: 'surface-objects',
    description: 'Ключи верхнего уровня в metadata момента',
  },
  {
    key: 'LIMIT_MOMENTS_PER_SPACE_PER_DAY',
    path: 'moments.perSpacePerDay',
    unit: 'requests/day',
    production: 200,
    min: 10,
    max: 5000,
    owner: 'surface-objects',
    description: 'Создание моментов в пространстве за сутки',
  },
  {
    key: 'LIMIT_OBJECTS_PER_SURFACE',
    path: 'moments.objectsPerSurface',
    unit: 'items',
    production: 500,
    min: 10,
    max: 10000,
    owner: 'surfaces',
    description: 'Объекты на одной поверхности',
  },

  // HTTP-граница
  {
    key: 'LIMIT_REQUEST_BODY_MAX_BYTES',
    path: 'http.requestBodyMaxBytes',
    unit: 'bytes',
    production: 262144,
    min: 4096,
    max: 5242880,
    owner: 'bootstrap',
    description: 'Максимальный размер тела запроса',
  },
  {
    key: 'LIMIT_JSON_DEPTH_MAX',
    path: 'http.jsonDepthMax',
    unit: 'items',
    production: 8,
    min: 2,
    max: 32,
    owner: 'bootstrap',
    description: 'Глубина вложенности JSON в запросе',
  },
  {
    key: 'LIMIT_PAGE_SIZE_MAX',
    path: 'http.pageSizeMax',
    unit: 'items',
    production: 100,
    min: 10,
    max: 500,
    owner: 'bootstrap',
    description: 'Максимальный limit пагинации; совпадает с paginationQuerySchema',
  },
  {
    key: 'LIMIT_IDEMPOTENCY_KEY_MAX_LENGTH',
    path: 'http.idempotencyKeyMaxLength',
    unit: 'characters',
    production: 200,
    min: 32,
    max: 512,
    owner: 'shared/idempotency',
    description: 'Длина idempotency key',
  },
  {
    key: 'LIMIT_IDEMPOTENCY_RECORD_TTL_HOURS',
    path: 'http.idempotencyRecordTtlHours',
    unit: 'hours',
    production: 24,
    min: 1,
    max: 168,
    owner: 'shared/idempotency',
    description: 'Срок жизни записи idempotency_records',
  },

  // Медиа
  {
    key: 'LIMIT_MEDIA_IMAGE_MAX_BYTES',
    path: 'media.imageMaxBytes',
    unit: 'bytes',
    production: 10485760,
    min: 65536,
    max: 52428800,
    owner: 'media',
    description: 'Размер изображения',
  },
  {
    key: 'LIMIT_MEDIA_AUDIO_MAX_BYTES',
    path: 'media.audioMaxBytes',
    unit: 'bytes',
    production: 26214400,
    min: 65536,
    max: 104857600,
    owner: 'media',
    description: 'Размер аудиозаписи',
  },
  {
    key: 'LIMIT_MEDIA_AUDIO_MAX_SECONDS',
    path: 'media.audioMaxSeconds',
    unit: 'seconds',
    production: 180,
    min: 5,
    max: 3600,
    owner: 'media',
    description: 'Длительность аудиозаписи',
  },
  {
    key: 'LIMIT_MEDIA_UPLOADS_PER_USER_PER_DAY',
    path: 'media.uploadsPerUserPerDay',
    unit: 'requests/day',
    production: 50,
    min: 1,
    max: 1000,
    owner: 'media',
    description: 'Загрузки медиа пользователем за сутки',
  },
  {
    key: 'LIMIT_MEDIA_URL_TTL_SECONDS',
    path: 'media.signedUrlTtlSeconds',
    unit: 'seconds',
    production: 900,
    min: 60,
    max: 86400,
    owner: 'media',
    description: 'Срок жизни подписанной ссылки на приватный файл',
  },

  // AI
  {
    key: 'LIMIT_AI_INPUT_MAX_CHARACTERS',
    path: 'ai.inputMaxCharacters',
    unit: 'characters',
    production: 8000,
    min: 500,
    max: 100000,
    owner: 'ai',
    description: 'Размер входных данных, уходящих провайдеру',
  },
  {
    key: 'LIMIT_AI_REQUESTS_PER_USER_PER_MINUTE',
    path: 'ai.requestsPerUserPerMinute',
    unit: 'requests/minute',
    production: 3,
    min: 1,
    max: 60,
    owner: 'ai',
    description: 'Запросы к AI на пользователя в минуту',
  },
  {
    key: 'LIMIT_AI_REQUESTS_PER_USER_PER_DAY',
    path: 'ai.requestsPerUserPerDay',
    unit: 'requests/day',
    production: 20,
    min: 1,
    max: 1000,
    owner: 'ai',
    description: 'Запросы к AI на пользователя в сутки',
  },
  {
    key: 'LIMIT_AI_PROVIDER_TIMEOUT_MS',
    path: 'ai.providerTimeoutMs',
    unit: 'milliseconds',
    production: 20000,
    min: 1000,
    max: 120000,
    owner: 'ai',
    description: 'Таймаут вызова AI-провайдера',
  },
  {
    key: 'LIMIT_AI_DAILY_BUDGET_USD_CENTS',
    path: 'ai.dailyBudgetUsdCents',
    unit: 'usd cents/day',
    production: 500,
    min: 1,
    max: 1000000,
    owner: 'ai',
    description: 'Суточный бюджет на AI; при исчерпании вызовы провайдера не выполняются',
  },

  // Приватность и поддержка
  {
    key: 'LIMIT_SUPPORT_MESSAGE_MAX_LENGTH',
    path: 'privacy.supportMessageMaxLength',
    unit: 'characters',
    production: 4000,
    min: 100,
    max: 20000,
    owner: 'support',
    description: 'Длина обращения в поддержку',
  },
  {
    key: 'LIMIT_SUPPORT_REQUESTS_PER_USER_PER_DAY',
    path: 'privacy.supportRequestsPerUserPerDay',
    unit: 'requests/day',
    production: 5,
    min: 1,
    max: 100,
    owner: 'support',
    description: 'Обращения в поддержку за сутки',
  },
  {
    key: 'LIMIT_EXPORT_REQUESTS_PER_USER_PER_DAY',
    path: 'privacy.exportRequestsPerUserPerDay',
    unit: 'requests/day',
    production: 2,
    min: 1,
    max: 50,
    owner: 'privacy',
    description: 'Запросы экспорта данных за сутки',
  },
  {
    key: 'LIMIT_DELETION_REQUESTS_PER_USER_PER_DAY',
    path: 'privacy.deletionRequestsPerUserPerDay',
    unit: 'requests/day',
    production: 5,
    min: 1,
    max: 50,
    owner: 'privacy',
    description: 'Запросы удаления аккаунта за сутки; повторный запрос идемпотентен',
  },
];

export type AppLimits = {
  readonly auth: {
    readonly emailMaxLength: number;
    readonly passwordMinLength: number;
    readonly passwordMaxLength: number;
    readonly displayNameMaxLength: number;
    readonly activeSessionsPerUser: number;
    readonly signInAttemptsPerHour: number;
    readonly signUpPerIpPerHour: number;
    readonly passwordResetPerEmailPerHour: number;
  };
  readonly spaces: {
    readonly spacesPerUser: number;
    readonly titleMaxLength: number;
    readonly membersPerSpace: number;
  };
  readonly invitations: {
    readonly pendingPerSpace: number;
    readonly perUserPerDay: number;
    readonly ttlHours: number;
  };
  readonly moments: {
    readonly textMaxLength: number;
    readonly metadataMaxBytes: number;
    readonly metadataMaxKeys: number;
    readonly perSpacePerDay: number;
    readonly objectsPerSurface: number;
  };
  readonly http: {
    readonly requestBodyMaxBytes: number;
    readonly jsonDepthMax: number;
    readonly pageSizeMax: number;
    readonly idempotencyKeyMaxLength: number;
    readonly idempotencyRecordTtlHours: number;
  };
  readonly media: {
    readonly imageMaxBytes: number;
    readonly audioMaxBytes: number;
    readonly audioMaxSeconds: number;
    readonly uploadsPerUserPerDay: number;
    readonly signedUrlTtlSeconds: number;
  };
  readonly ai: {
    readonly inputMaxCharacters: number;
    readonly requestsPerUserPerMinute: number;
    readonly requestsPerUserPerDay: number;
    readonly providerTimeoutMs: number;
    readonly dailyBudgetUsdCents: number;
  };
  readonly privacy: {
    readonly supportMessageMaxLength: number;
    readonly supportRequestsPerUserPerDay: number;
    readonly exportRequestsPerUserPerDay: number;
    readonly deletionRequestsPerUserPerDay: number;
  };
};

export const LIMITS = Symbol('LIMITS');

const INTEGER = /^-?\d+$/;

/**
 * Читает лимиты из окружения. Сообщение об ошибке содержит ключ, допустимый
 * диапазон и единицу измерения — но не другие значения окружения
 * (см. docs/foundation-contracts.md).
 */
export function loadLimits(source: NodeJS.ProcessEnv = process.env): AppLimits {
  const values: Record<string, number> = {};
  const failures: string[] = [];

  for (const definition of LIMIT_DEFINITIONS) {
    const raw = source[definition.key];
    const range = `${definition.min}–${definition.max} ${definition.unit}`;

    if (raw === undefined) {
      values[definition.key] = definition.production;
      continue;
    }

    const trimmed = raw.trim();

    if (!INTEGER.test(trimmed)) {
      failures.push(`${definition.key}: ожидается целое число в диапазоне ${range}`);
      continue;
    }

    const parsed = Number(trimmed);

    if (parsed < definition.min || parsed > definition.max) {
      failures.push(`${definition.key}: ${parsed} вне диапазона ${range}`);
      continue;
    }

    values[definition.key] = parsed;
  }

  if (failures.length > 0) {
    throw new Error(`Некорректные лимиты (issue #38):\n  ${failures.join('\n  ')}`);
  }

  const at = (key: string): number => {
    const value = values[key];

    if (value === undefined)
      throw new Error(`Лимит ${key} отсутствует в реестре LIMIT_DEFINITIONS`);

    return value;
  };

  return {
    auth: {
      emailMaxLength: at('LIMIT_EMAIL_MAX_LENGTH'),
      passwordMinLength: at('LIMIT_PASSWORD_MIN_LENGTH'),
      passwordMaxLength: at('LIMIT_PASSWORD_MAX_LENGTH'),
      displayNameMaxLength: at('LIMIT_DISPLAY_NAME_MAX_LENGTH'),
      activeSessionsPerUser: at('LIMIT_ACTIVE_SESSIONS_PER_USER'),
      signInAttemptsPerHour: at('LIMIT_SIGN_IN_ATTEMPTS_PER_HOUR'),
      signUpPerIpPerHour: at('LIMIT_SIGN_UP_PER_IP_PER_HOUR'),
      passwordResetPerEmailPerHour: at('LIMIT_PASSWORD_RESET_PER_EMAIL_PER_HOUR'),
    },
    spaces: {
      spacesPerUser: at('LIMIT_SPACES_PER_USER'),
      titleMaxLength: at('LIMIT_SPACE_TITLE_MAX_LENGTH'),
      membersPerSpace: at('LIMIT_MEMBERS_PER_SPACE'),
    },
    invitations: {
      pendingPerSpace: at('LIMIT_PENDING_INVITATIONS_PER_SPACE'),
      perUserPerDay: at('LIMIT_INVITATIONS_PER_USER_PER_DAY'),
      ttlHours: at('LIMIT_INVITATION_TTL_HOURS'),
    },
    moments: {
      textMaxLength: at('LIMIT_MOMENT_TEXT_MAX_LENGTH'),
      metadataMaxBytes: at('LIMIT_MOMENT_METADATA_MAX_BYTES'),
      metadataMaxKeys: at('LIMIT_MOMENT_METADATA_MAX_KEYS'),
      perSpacePerDay: at('LIMIT_MOMENTS_PER_SPACE_PER_DAY'),
      objectsPerSurface: at('LIMIT_OBJECTS_PER_SURFACE'),
    },
    http: {
      requestBodyMaxBytes: at('LIMIT_REQUEST_BODY_MAX_BYTES'),
      jsonDepthMax: at('LIMIT_JSON_DEPTH_MAX'),
      pageSizeMax: at('LIMIT_PAGE_SIZE_MAX'),
      idempotencyKeyMaxLength: at('LIMIT_IDEMPOTENCY_KEY_MAX_LENGTH'),
      idempotencyRecordTtlHours: at('LIMIT_IDEMPOTENCY_RECORD_TTL_HOURS'),
    },
    media: {
      imageMaxBytes: at('LIMIT_MEDIA_IMAGE_MAX_BYTES'),
      audioMaxBytes: at('LIMIT_MEDIA_AUDIO_MAX_BYTES'),
      audioMaxSeconds: at('LIMIT_MEDIA_AUDIO_MAX_SECONDS'),
      uploadsPerUserPerDay: at('LIMIT_MEDIA_UPLOADS_PER_USER_PER_DAY'),
      signedUrlTtlSeconds: at('LIMIT_MEDIA_URL_TTL_SECONDS'),
    },
    ai: {
      inputMaxCharacters: at('LIMIT_AI_INPUT_MAX_CHARACTERS'),
      requestsPerUserPerMinute: at('LIMIT_AI_REQUESTS_PER_USER_PER_MINUTE'),
      requestsPerUserPerDay: at('LIMIT_AI_REQUESTS_PER_USER_PER_DAY'),
      providerTimeoutMs: at('LIMIT_AI_PROVIDER_TIMEOUT_MS'),
      dailyBudgetUsdCents: at('LIMIT_AI_DAILY_BUDGET_USD_CENTS'),
    },
    privacy: {
      supportMessageMaxLength: at('LIMIT_SUPPORT_MESSAGE_MAX_LENGTH'),
      supportRequestsPerUserPerDay: at('LIMIT_SUPPORT_REQUESTS_PER_USER_PER_DAY'),
      exportRequestsPerUserPerDay: at('LIMIT_EXPORT_REQUESTS_PER_USER_PER_DAY'),
      deletionRequestsPerUserPerDay: at('LIMIT_DELETION_REQUESTS_PER_USER_PER_DAY'),
    },
  };
}
