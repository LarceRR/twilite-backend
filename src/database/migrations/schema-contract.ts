import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Зафиксированный контракт схемы (issue #28).
 *
 * Объекты перечислены явно, чтобы CI мог доказать, что после миграций в базе
 * действительно существуют инварианты, на которые опирается бэкенд: владение,
 * уникальность, каскадное удаление и optimistic lock. Изменение схемы без
 * обновления контракта падает и в юнит-тестах, и в проверке реальной базы.
 */

export const EXPECTED_TABLES = [
  'ai_insights',
  'analytics_events',
  'audit_log',
  'billing_webhook_events',
  'device_tokens',
  'entitlements',
  'idempotency_records',
  'invitations',
  'media_assets',
  'notifications',
  'sessions',
  'space_members',
  'spaces',
  'subscriptions',
  'surface_objects',
  'surfaces',
  'timeline_events',
  'user_credentials',
  'user_preferences',
  'users',
] as const;

export type IndexContract = {
  readonly name: string;
  readonly table: string;
  readonly unique: boolean;
  readonly partial: boolean;
};

/** Уникальность здесь — это инвариант домена, а не оптимизация. */
export const EXPECTED_INDEXES: readonly IndexContract[] = [
  { name: 'users_email_unique', table: 'users', unique: true, partial: false },
  { name: 'device_tokens_token_unique', table: 'device_tokens', unique: true, partial: false },
  { name: 'surfaces_space_unique', table: 'surfaces', unique: true, partial: false },
  { name: 'surface_objects_cell_unique', table: 'surface_objects', unique: true, partial: false },
  { name: 'invitations_pending_unique', table: 'invitations', unique: true, partial: true },
  { name: 'idempotency_scope_key_unique', table: 'idempotency_records', unique: true, partial: false },
  { name: 'idempotency_expires_idx', table: 'idempotency_records', unique: false, partial: false },
  { name: 'ai_insights_space_idx', table: 'ai_insights', unique: false, partial: false },
  { name: 'analytics_name_idx', table: 'analytics_events', unique: false, partial: false },
  { name: 'audit_action_idx', table: 'audit_log', unique: false, partial: false },
  { name: 'entitlements_user_key_idx', table: 'entitlements', unique: false, partial: false },
  { name: 'subscriptions_user_idx', table: 'subscriptions', unique: false, partial: false },
  { name: 'media_owner_idx', table: 'media_assets', unique: false, partial: false },
  { name: 'notifications_user_idx', table: 'notifications', unique: false, partial: false },
  { name: 'sessions_user_idx', table: 'sessions', unique: false, partial: false },
  { name: 'sessions_expires_idx', table: 'sessions', unique: false, partial: false },
  { name: 'invitations_invitee_email_idx', table: 'invitations', unique: false, partial: false },
  { name: 'space_members_user_idx', table: 'space_members', unique: false, partial: false },
  { name: 'spaces_owner_idx', table: 'spaces', unique: false, partial: false },
  { name: 'surface_objects_surface_idx', table: 'surface_objects', unique: false, partial: false },
  { name: 'surface_objects_space_idx', table: 'surface_objects', unique: false, partial: false },
  { name: 'surface_objects_state_updated_idx', table: 'surface_objects', unique: false, partial: false },
  { name: 'timeline_space_sequence_idx', table: 'timeline_events', unique: false, partial: false },
  { name: 'timeline_space_type_idx', table: 'timeline_events', unique: false, partial: false },
];

export type ForeignKeyContract = { readonly name: string; readonly onDelete: 'cascade' | 'set null' };

/**
 * Правило удаления — часть privacy-контракта: удаление аккаунта не должно
 * оставлять висящие персональные записи, а обезличиваемые ссылки не должны
 * удалять чужую историю.
 */
export const EXPECTED_FOREIGN_KEYS: readonly ForeignKeyContract[] = [
  { name: 'ai_insights_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'ai_insights_requested_by_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'analytics_events_user_id_users_id_fk', onDelete: 'set null' },
  { name: 'audit_log_actor_user_id_users_id_fk', onDelete: 'set null' },
  { name: 'entitlements_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'subscriptions_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'media_assets_owner_id_users_id_fk', onDelete: 'cascade' },
  { name: 'media_assets_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'device_tokens_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'notifications_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'sessions_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'invitations_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'invitations_invited_by_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'invitations_invitee_user_id_users_id_fk', onDelete: 'set null' },
  { name: 'space_members_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'space_members_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'spaces_owner_id_users_id_fk', onDelete: 'cascade' },
  { name: 'surface_objects_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'surface_objects_surface_id_surfaces_id_fk', onDelete: 'cascade' },
  { name: 'surface_objects_created_by_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'surface_objects_subject_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'surfaces_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'timeline_events_space_id_spaces_id_fk', onDelete: 'cascade' },
  { name: 'timeline_events_actor_user_id_users_id_fk', onDelete: 'set null' },
  { name: 'timeline_events_subject_user_id_users_id_fk', onDelete: 'set null' },
  { name: 'user_credentials_user_id_users_id_fk', onDelete: 'cascade' },
  { name: 'user_preferences_user_id_users_id_fk', onDelete: 'cascade' },
];

/** Составной ключ участников пространства защищает от двойного membership. */
export const EXPECTED_PRIMARY_KEYS: readonly string[] = [
  'space_members_space_id_user_id_pk',
  ...EXPECTED_TABLES.filter((table) => table !== 'space_members').map((table) => `${table}_pkey`),
];

export type ColumnContract = { readonly table: string; readonly column: string; readonly nullable: boolean };

/**
 * Обязательность колонок, которые меняли миграции: если `0002` не применилась,
 * `status` будет отсутствовать, а `response`/`status_code` останутся NOT NULL и
 * pending-резервирование idempotency сломается в рантайме, а не в CI.
 */
export const EXPECTED_COLUMN_NULLABILITY: readonly ColumnContract[] = [
  { table: 'idempotency_records', column: 'status', nullable: false },
  { table: 'idempotency_records', column: 'request_hash', nullable: false },
  { table: 'idempotency_records', column: 'expires_at', nullable: false },
  { table: 'idempotency_records', column: 'response', nullable: true },
  { table: 'idempotency_records', column: 'status_code', nullable: true },
  { table: 'users', column: 'email', nullable: false },
  { table: 'spaces', column: 'owner_id', nullable: false },
  { table: 'spaces', column: 'version', nullable: false },
  { table: 'surfaces', column: 'version', nullable: false },
  { table: 'surface_objects', column: 'version', nullable: false },
  { table: 'surface_objects', column: 'created_by_user_id', nullable: false },
  { table: 'space_members', column: 'role', nullable: false },
  { table: 'sessions', column: 'refresh_token_hash', nullable: false },
  { table: 'sessions', column: 'expires_at', nullable: false },
];

const MIGRATIONS_DIRECTORY = 'src/database/migrations';

export function migrationsDirectory(): string {
  const directory = resolve(process.cwd(), MIGRATIONS_DIRECTORY);

  if (!existsSync(directory)) {
    throw new Error(`Каталог миграций не найден: ${MIGRATIONS_DIRECTORY}. Команду нужно запускать из каталога backend.`);
  }

  return directory;
}

export function migrationFileNames(): readonly string[] {
  return readdirSync(migrationsDirectory())
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

export function migrationSql(): string {
  const directory = migrationsDirectory();

  return migrationFileNames()
    .map((name) => readFileSync(resolve(directory, name), 'utf8'))
    .join('\n');
}
