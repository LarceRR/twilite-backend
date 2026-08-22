/**
 * `kind` is an open registry, not a closed enum: new kinds arrive through
 * `kindPolicies` without new entities, tables or modules. The string type is
 * deliberate — unknown kinds from a newer client fall back to a default policy.
 */
export type SurfaceObjectKind = string;

export const knownKinds = {
  fire: 'Fire',
  cloud: 'Cloud',
} as const;

export type KindValence = 'positive' | 'negative' | 'neutral';

export type KindPolicy = {
  readonly kind: SurfaceObjectKind;
  readonly valence: KindValence;
  /** Personal spaces may allow reacting to your own actions. */
  readonly allowSelfSubject: boolean;
  /** How far from an occupied cell this kind may spawn. */
  readonly spawnRadius: number;
  /**
   * Minimum Chebyshev distance to any other object.
   * `2` = none of the 8 neighbouring cells may already hold an object.
   */
  readonly minSeparation: number;
  /** Transitions this kind refuses, even though the state machine allows them. */
  readonly blockedTransitions: readonly string[];
};

const defaultPolicy: KindPolicy = {
  kind: 'Unknown',
  valence: 'neutral',
  allowSelfSubject: true,
  spawnRadius: 2,
  minSeparation: 1,
  blockedTransitions: [],
};

const policies: Readonly<Record<string, KindPolicy>> = {
  [knownKinds.fire]: {
    kind: knownKinds.fire,
    valence: 'positive',
    allowSelfSubject: true,
    spawnRadius: 3,
    minSeparation: 2,
    blockedTransitions: [],
  },
  [knownKinds.cloud]: {
    kind: knownKinds.cloud,
    valence: 'negative',
    allowSelfSubject: true,
    spawnRadius: 2,
    minSeparation: 1,
    blockedTransitions: [],
  },
};

export function kindPolicy(kind: SurfaceObjectKind): KindPolicy {
  return policies[kind] ?? { ...defaultPolicy, kind };
}

export function isKnownKind(kind: SurfaceObjectKind): boolean {
  return kind in policies;
}

export function allKindPolicies(): readonly KindPolicy[] {
  return Object.values(policies);
}
