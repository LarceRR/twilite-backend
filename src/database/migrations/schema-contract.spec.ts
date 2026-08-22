import { describe, expect, it } from 'vitest';

import {
  EXPECTED_FOREIGN_KEYS,
  EXPECTED_INDEXES,
  EXPECTED_TABLES,
  migrationFileNames,
  migrationSql,
} from './schema-contract';

const sql = migrationSql();

/**
 * Контракт схемы не должен расходиться с миграциями: тест ловит дрейф без базы,
 * а `db:verify` затем проверяет ту же таблицу истины на реальной БД в CI.
 */
describe('контракт схемы соответствует миграциям', () => {
  it('находит файлы миграций', () => {
    expect(migrationFileNames().length).toBeGreaterThan(0);
  });

  it.each([...EXPECTED_TABLES])('таблица %s создаётся миграцией', (table) => {
    expect(new RegExp(`CREATE TABLE (IF NOT EXISTS )?"${table}"`).test(sql)).toBe(true);
  });

  it.each(EXPECTED_INDEXES.map((index) => [index.name, index] as const))(
    'индекс %s создаётся с ожидаемыми свойствами',
    (_name, index) => {
      const statement = new RegExp(`CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?"${index.name}"[^;]*`).exec(sql)?.[0];

      expect(statement).toBeDefined();
      expect(statement?.includes('UNIQUE')).toBe(index.unique);
      expect(/ WHERE /.test(statement ?? '')).toBe(index.partial);
    },
  );

  it.each(EXPECTED_FOREIGN_KEYS.map((key) => [key.name, key.onDelete] as const))(
    'внешний ключ %s удаляет по правилу %s',
    (name, onDelete) => {
      const statement = new RegExp(`ADD CONSTRAINT "${name}" FOREIGN KEY[^;]*`).exec(sql)?.[0];

      expect(statement).toBeDefined();
      expect(statement?.toLowerCase()).toContain(`on delete ${onDelete}`);
    },
  );

  it('не содержит дублирующихся имён объектов', () => {
    const names = [
      ...EXPECTED_TABLES,
      ...EXPECTED_INDEXES.map((index) => index.name),
      ...EXPECTED_FOREIGN_KEYS.map((key) => key.name),
    ];

    expect(new Set(names).size).toBe(names.length);
  });
});
