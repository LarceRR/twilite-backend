import { describe, expect, it } from 'vitest';

import type { SpaceId } from '@/modules/spaces/domain/value-objects/SpacePermission';
import {
  applyTransition,
  assertVersion,
  type SurfaceObject,
  withFavorite,
  withMetadata,
} from '@/modules/surface-objects/domain/entities/SurfaceObject';
import { originCell } from '@/modules/surface-objects/domain/value-objects/Cell';
import { knownKinds } from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';
import {
  canTransition,
  nextState,
} from '@/modules/surface-objects/domain/value-objects/SurfaceObjectState';
import type { SurfaceId } from '@/modules/surfaces/domain/value-objects/SurfaceId';
import type { UserId } from '@/modules/users/domain/value-objects/UserId';
import { AppError } from '@/shared/errors';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const LATER = new Date('2026-01-02T12:00:00.000Z');

function makeObject(overrides: Partial<SurfaceObject> = {}): SurfaceObject {
  return {
    id: 'object-1' as SurfaceObject['id'],
    spaceId: 'space-1' as SpaceId,
    surfaceId: 'surface-1' as SurfaceId,
    cell: originCell,
    kind: knownKinds.fire,
    state: 'Emerging',
    createdByUserId: 'user-1' as UserId,
    subjectUserId: 'user-2' as UserId,
    metadata: {},
    favorite: false,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

describe('жизненный цикл SurfaceObject', () => {
  it('проходит Emerging → Active → Fading → Settled', () => {
    const emerging = makeObject();
    const active = applyTransition(emerging, 'activate', LATER);
    const fading = applyTransition(active, 'soften', LATER);
    const settled = applyTransition(fading, 'age', LATER);

    expect([active.state, fading.state, settled.state]).toEqual(['Active', 'Fading', 'Settled']);
  });

  it('запрещает перескакивать через состояние', () => {
    expect(() => nextState('Emerging', 'age')).toThrow(/Недопустимый переход/);
    expect(canTransition('Emerging', 'age')).toBe(false);
  });

  it('не выводит объект из финального состояния', () => {
    const settled = makeObject({ state: 'Settled' });

    expect(() => applyTransition(settled, 'activate', LATER)).toThrow(/Недопустимый переход/);
  });

  it('поднимает версию при каждом изменении', () => {
    const object = makeObject();

    expect(applyTransition(object, 'activate', LATER).version).toBe(2);
    expect(withMetadata(object, { note: 'спасибо' }, LATER).version).toBe(2);
    expect(withFavorite(object, true, LATER).version).toBe(2);
  });

  it('обновляет updatedAt, но сохраняет createdAt', () => {
    const updated = applyTransition(makeObject(), 'activate', LATER);

    expect(updated.updatedAt).toEqual(LATER);
    expect(updated.createdAt).toEqual(NOW);
  });

  it('сообщает конфликт, если клиент видел другую версию', () => {
    const object = makeObject({ version: 4 });

    expect(() => assertVersion(object, 4)).not.toThrow();

    try {
      assertVersion(object, 3);
      expect.unreachable('ожидался конфликт версий');
    } catch (error) {
      expect((error as AppError).kind).toBe('conflict');
    }
  });
});
