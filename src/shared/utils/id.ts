import { randomUUID } from 'node:crypto';

/** Identifier generation is centralised so the format can change in one place. */
export interface IdGenerator {
  next(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export const uuidGenerator: IdGenerator = {
  next: () => randomUUID(),
};
