import { describe, expect, it } from 'vitest';

import { parseEnvFile } from './load-env';

describe('parseEnvFile', () => {
  it('читает пары ключ-значение и пропускает комментарии и пустые строки', () => {
    const parsed = parseEnvFile(['# комментарий', '', 'PORT=3000', 'HOST=0.0.0.0'].join('\n'));

    expect(parsed.get('PORT')).toBe('3000');
    expect(parsed.get('HOST')).toBe('0.0.0.0');
    expect(parsed.size).toBe(2);
  });

  it('срезает CRLF и BOM, которыми Windows-редакторы портят файл', () => {
    const parsed = parseEnvFile('\uFEFFREDIS_URL=redis://localhost:6379\r\nPORT=3000\r\n');

    expect(parsed.get('REDIS_URL')).toBe('redis://localhost:6379');
    expect(parsed.get('PORT')).toBe('3000');
  });

  it('снимает кавычки и понимает префикс export', () => {
    const parsed = parseEnvFile(
      ['export JWT_ACCESS_SECRET="a b c"', "AI_MODEL='gpt-4o-mini'"].join('\n'),
    );

    expect(parsed.get('JWT_ACCESS_SECRET')).toBe('a b c');
    expect(parsed.get('AI_MODEL')).toBe('gpt-4o-mini');
  });

  it('режет комментарий в конце строки, но не # внутри значения', () => {
    const parsed = parseEnvFile(
      ['PORT=3000 # порт API', 'DATABASE_URL=postgres://twilite:pa#ss@localhost:5432/twilite'].join('\n'),
    );

    expect(parsed.get('PORT')).toBe('3000');
    expect(parsed.get('DATABASE_URL')).toBe('postgres://twilite:pa#ss@localhost:5432/twilite');
  });
});
