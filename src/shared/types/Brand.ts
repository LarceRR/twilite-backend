declare const brand: unique symbol;

/**
 * Nominal typing over primitives: branded values remain distinct from strings
 * even though they share the same runtime representation.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };
