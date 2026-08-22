import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Node не читает `.env` сам, а `nest start --watch`, `tsx` и `drizzle-kit` поднимают
 * обычный процесс node. Без этого модуля единственный способ запустить API вне
 * Docker — руками выставить все переменные (`set X=...` в cmd), что и происходило.
 *
 * Модуль импортируется первым в `config/env.ts`, поэтому любая точка входа —
 * сервер, миграции, seed — получает `.env` автоматически.
 *
 * Приоритет: реальные переменные окружения > `.env.local` > `.env`. Docker и CI,
 * которые передают переменные через окружение, ничего не теряют.
 */

const ENV_FILE_NAMES = ['.env.local', '.env'] as const;

const ENTRY = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;

const QUOTES = new Set(['"', "'", '`']);

/**
 * Свой парсер вместо dotenv: сорок строк дешевле новой зависимости в lock-файле и
 * в Docker-образе. Многострочные значения не поддерживаются — в конфиге их нет.
 */
export function parseEnvFile(content: string): Map<string, string> {
  const values = new Map<string, string>();

  // BOM и \r — то, чем Windows-редакторы портят .env. Без их удаления значение
  // приезжает как "redis://localhost:6379\r" и подключение молча не работает.
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const match = ENTRY.exec(line);
    const key = match?.[1];

    if (match === null || key === undefined) {
      continue;
    }

    values.set(key, unwrapValue(match[2] ?? ''));
  }

  return values;
}

function unwrapValue(raw: string): string {
  const value = raw.trim();
  const quote = value.charAt(0);

  if (QUOTES.has(quote) && value.length > 1 && value.endsWith(quote)) {
    const inner = value.slice(1, -1);

    return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : inner;
  }

  // Без кавычек комментарий в конце строки не часть значения.
  const commentAt = value.indexOf(' #');

  return commentAt === -1 ? value : value.slice(0, commentAt).trimEnd();
}

/**
 * Ищем вверх от рабочей директории и от самого модуля, чтобы `npm run dev` из
 * backend/, `tsx src/...` и `node backend/dist/main.js` из корня репозитория вели
 * себя одинаково. Подъём останавливается на директории с package.json — чужой
 * .env откуда-то выше по диску подхватывать нельзя.
 */
function findEnvFile(fileName: string, startDir: string): string | undefined {
  let current = resolve(startDir);

  for (;;) {
    const candidate = resolve(current, fileName);

    if (existsSync(candidate)) {
      return candidate;
    }

    if (existsSync(resolve(current, 'package.json'))) {
      return undefined;
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

function loadEnvFiles(): readonly string[] {
  const startDirs = [process.cwd(), __dirname];
  const files: string[] = [];

  for (const fileName of ENV_FILE_NAMES) {
    for (const startDir of startDirs) {
      const found = findEnvFile(fileName, startDir);

      if (found !== undefined && !files.includes(found)) {
        files.push(found);
      }
    }
  }

  for (const file of files) {
    for (const [key, value] of parseEnvFile(readFileSync(file, 'utf8'))) {
      // Уже заданная переменная сильнее файла.
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  return files;
}

/** Пути прочитанных файлов — попадают в сообщение об ошибке конфигурации. */
export const loadedEnvFiles: readonly string[] = loadEnvFiles();
