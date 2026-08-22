import { describe, expect, it } from 'vitest';

import {
  allKindPolicies,
  isKnownKind,
  kindPolicy,
  knownKinds,
} from '@/modules/surface-objects/domain/value-objects/SurfaceObjectKind';

describe('реестр типов объектов', () => {
  it('описывает Fire и Cloud противоположными по знаку', () => {
    expect(kindPolicy(knownKinds.fire).valence).toBe('positive');
    expect(kindPolicy(knownKinds.cloud).valence).toBe('negative');
  });

  it('принимает неизвестный тип с нейтральной политикой по умолчанию', () => {
    // A newer client may send a kind this build has never heard of.
    const policy = kindPolicy('Rainbow');

    expect(isKnownKind('Rainbow')).toBe(false);
    expect(policy.kind).toBe('Rainbow');
    expect(policy.valence).toBe('neutral');
    expect(policy.spawnRadius).toBeGreaterThan(0);
  });

  it('отдаёт клиенту все известные политики', () => {
    expect(allKindPolicies().map((policy) => policy.kind)).toEqual([
      knownKinds.fire,
      knownKinds.cloud,
    ]);
  });
});
