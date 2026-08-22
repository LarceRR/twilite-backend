import { DomainError } from '@/shared/errors';

export const surfaceObjectStates = ['Emerging', 'Active', 'Fading', 'Settled'] as const;

export type SurfaceObjectState = (typeof surfaceObjectStates)[number];

export const surfaceObjectTransitions = ['activate', 'soften', 'age'] as const;

export type SurfaceObjectTransition = (typeof surfaceObjectTransitions)[number];

/**
 * The lifecycle is explicit and shared by every kind. There is no implicit
 * state change anywhere in the system: a state moves only through a transition.
 */
const TRANSITIONS: Readonly<
  Record<
    SurfaceObjectTransition,
    { readonly from: SurfaceObjectState; readonly to: SurfaceObjectState }
  >
> = {
  activate: { from: 'Emerging', to: 'Active' },
  soften: { from: 'Active', to: 'Fading' },
  age: { from: 'Fading', to: 'Settled' },
};

export function isSurfaceObjectState(value: string): value is SurfaceObjectState {
  return (surfaceObjectStates as readonly string[]).includes(value);
}

export function nextState(
  current: SurfaceObjectState,
  transition: SurfaceObjectTransition,
): SurfaceObjectState {
  const rule = TRANSITIONS[transition];

  if (rule.from !== current) {
    throw new DomainError('Недопустимый переход состояния', {
      current,
      transition,
      expectedFrom: rule.from,
    });
  }

  return rule.to;
}

export function canTransition(
  current: SurfaceObjectState,
  transition: SurfaceObjectTransition,
): boolean {
  return TRANSITIONS[transition].from === current;
}
