import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/shared/errors';

import { DEFAULT_PIXEL_SIZE } from '../constants';
import { normalizePixelSize } from './normalizePixelSize';

describe('normalizePixelSize', () => {
  it('возвращает дефолт, если значение не передано', () => {
    expect(normalizePixelSize(undefined)).toBe(DEFAULT_PIXEL_SIZE);
  });

  it('принимает целое число в диапазоне', () => {
    expect(normalizePixelSize(16)).toBe(16);
  });

  it('отклоняет дробные и выходящие за диапазон значения', () => {
    expect(() => normalizePixelSize(1)).toThrow(ValidationError);
    expect(() => normalizePixelSize(101)).toThrow(ValidationError);
    expect(() => normalizePixelSize(8.5)).toThrow(ValidationError);
  });
});
