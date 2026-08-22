import postgres from 'postgres';

import { loadConfig } from '@/config/env';

import {
  EXPECTED_COLUMN_NULLABILITY,
  EXPECTED_FOREIGN_KEYS,
  EXPECTED_INDEXES,
  EXPECTED_PRIMARY_KEYS,
  EXPECTED_TABLES,
  migrationFileNames,
} from './schema-contract';

/**
 * Проверка ограничений схемы после миграций (issue #28).
 *
 * Успешный выход `db:migrate` доказывает только то, что SQL применился. Здесь мы
 * сверяем фактическое состояние базы с контрактом: таблицы, первичные ключи,
 * внешние ключи с правилами удаления, уникальные и частичные индексы,
 * обязательность колонок и полноту журнала миграций.
 *
 * В CI скрипт запускается после миграций на пустой базе и после повторного
 * применения миграций на уже существующей базе. Наружу не выводится ни строка
 * подключения, ни данные — только имена объектов схемы.
 */
const DELETE_ACTIONS: Record<string, string> = {
  a: 'no action',
  r: 'restrict',
  c: 'cascade',
  n: 'set null',
  d: 'set default',
};

async function main(): Promise<void> {
  const config = loadConfig();
  const client = postgres(config.database.url, { max: 1 });
  const failures: string[] = [];
  let checks = 0;

  try {
    const tables = await client<{ name: string }[]>`
      SELECT table_name AS "name"
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = new Set(tables.map((row) => row.name));

    for (const table of EXPECTED_TABLES) {
      checks += 1;
      if (!tableNames.has(table)) failures.push(`нет таблицы "${table}"`);
    }

    const constraints = await client<{ name: string; type: string; deleteAction: string }[]>`
      SELECT c.conname AS "name", c.contype::text AS "type", c.confdeltype::text AS "deleteAction"
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
    `;

    const primaryKeys = new Set(constraints.filter((row) => row.type === 'p').map((row) => row.name));

    for (const name of EXPECTED_PRIMARY_KEYS) {
      checks += 1;
      if (!primaryKeys.has(name)) failures.push(`нет первичного ключа "${name}"`);
    }

    const foreignKeys = new Map(
      constraints
        .filter((row) => row.type === 'f')
        .map((row) => [row.name, DELETE_ACTIONS[row.deleteAction] ?? row.deleteAction] as const),
    );

    for (const expected of EXPECTED_FOREIGN_KEYS) {
      checks += 1;
      const actual = foreignKeys.get(expected.name);

      if (actual === undefined) {
        failures.push(`нет внешнего ключа "${expected.name}"`);
        continue;
      }

      if (actual !== expected.onDelete) {
        failures.push(`внешний ключ "${expected.name}": ON DELETE ${actual}, ожидается ${expected.onDelete}`);
      }
    }

    const indexes = await client<{ name: string; table: string; unique: boolean; partial: boolean }[]>`
      SELECT i.relname AS "name", t.relname AS "table", x.indisunique AS "unique", (x.indpred IS NOT NULL) AS "partial"
      FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_class t ON t.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
    `;
    const indexByName = new Map(indexes.map((row) => [row.name, row] as const));

    for (const expected of EXPECTED_INDEXES) {
      checks += 1;
      const actual = indexByName.get(expected.name);

      if (actual === undefined) {
        failures.push(`нет индекса "${expected.name}"`);
        continue;
      }

      if (actual.table !== expected.table) {
        failures.push(`индекс "${expected.name}" построен на "${actual.table}", ожидается "${expected.table}"`);
      }

      if (actual.unique !== expected.unique) {
        failures.push(`индекс "${expected.name}": unique=${actual.unique}, ожидается ${expected.unique}`);
      }

      if (actual.partial !== expected.partial) {
        failures.push(`индекс "${expected.name}": partial=${actual.partial}, ожидается ${expected.partial}`);
      }
    }

    const columns = await client<{ table: string; column: string; nullable: string }[]>`
      SELECT table_name AS "table", column_name AS "column", is_nullable AS "nullable"
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    const nullability = new Map(columns.map((row) => [`${row.table}.${row.column}`, row.nullable === 'YES'] as const));

    for (const expected of EXPECTED_COLUMN_NULLABILITY) {
      checks += 1;
      const actual = nullability.get(`${expected.table}.${expected.column}`);

      if (actual === undefined) {
        failures.push(`нет колонки "${expected.table}.${expected.column}"`);
        continue;
      }

      if (actual !== expected.nullable) {
        failures.push(`колонка "${expected.table}.${expected.column}": nullable=${actual}, ожидается ${expected.nullable}`);
      }
    }

    checks += 1;
    const expectedMigrations = migrationFileNames().length;
    let applied: number | undefined;

    try {
      const journal = await client<{ applied: number }[]>`
        SELECT count(*)::int AS "applied" FROM drizzle.__drizzle_migrations
      `;
      applied = journal[0]?.applied;
    } catch {
      applied = undefined;
    }

    if (applied === undefined) {
      failures.push('журнал drizzle.__drizzle_migrations недоступен: миграции не применялись');
    } else if (applied !== expectedMigrations) {
      failures.push(`применено миграций: ${applied}, файлов миграций: ${expectedMigrations}`);
    }
  } finally {
    await client.end();
  }

  if (failures.length > 0) {
    console.error(`Контракт схемы нарушен: ${failures.length} проблем(ы) из ${checks} проверок`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.warn(`Контракт схемы подтверждён: ${checks} проверок`);
}

main().catch((error: unknown) => {
  console.error('Не удалось проверить схему', error);
  process.exit(1);
});
