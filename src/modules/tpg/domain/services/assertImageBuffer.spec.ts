import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/shared/errors';

import { assertImageBuffer } from './assertImageBuffer';

const tinyPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('assertImageBuffer', () => {
  it('принимает PNG magic в лимите', () => {
    expect(() => assertImageBuffer(tinyPng, 100)).not.toThrow();
  });

  it('отклоняет пустой буфер', () => {
    expect(() => assertImageBuffer(Buffer.alloc(0), 10)).toThrow(ValidationError);
  });

  it('отклоняет буфер больше лимита', () => {
    expect(() => assertImageBuffer(Buffer.concat([tinyPng, Buffer.alloc(20)]), 10)).toThrow(
      ValidationError,
    );
  });

  it('отклоняет не-изображение', () => {
    expect(() => assertImageBuffer(Buffer.from('hello'), 100)).toThrow(ValidationError);
  });
});
