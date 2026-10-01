import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { pixelObjectManifestSchema } from '../src/tpo';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/manifests');

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

describe('golden manifest fixtures', () => {
  it('accepts one-frame.valid.json', () => {
    expect(pixelObjectManifestSchema.safeParse(loadJson('one-frame.valid.json')).success).toBe(
      true,
    );
  });

  it('rejects canvas-over-160.invalid.json', () => {
    expect(
      pixelObjectManifestSchema.safeParse(loadJson('canvas-over-160.invalid.json')).success,
    ).toBe(false);
  });

  it('rejects duplicate-frame.invalid.json', () => {
    expect(
      pixelObjectManifestSchema.safeParse(loadJson('duplicate-frame.invalid.json')).success,
    ).toBe(false);
  });
});
