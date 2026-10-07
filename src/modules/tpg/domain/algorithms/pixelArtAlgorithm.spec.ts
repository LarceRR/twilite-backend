import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/shared/errors';

import { DEFAULT_PIXEL_ART_ALGORITHM, normalizeAlgorithm } from './pixelArtAlgorithm';

describe('normalizeAlgorithm', () => {
  it('возвращает quantize по умолчанию', () => {
    expect(normalizeAlgorithm(undefined)).toBe(DEFAULT_PIXEL_ART_ALGORITHM);
  });

  it('принимает известные алгоритмы', () => {
    expect(normalizeAlgorithm('bayer')).toBe('bayer');
    expect(normalizeAlgorithm('floyd-steinberg')).toBe('floyd-steinberg');
    expect(normalizeAlgorithm('atkinson')).toBe('atkinson');
    expect(normalizeAlgorithm('center')).toBe('center');
  });

  it('отклоняет неизвестные', () => {
    expect(() => normalizeAlgorithm('ascii')).toThrow(ValidationError);
  });
});
