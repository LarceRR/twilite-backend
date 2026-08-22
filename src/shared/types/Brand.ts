declare const brand: unique symbol;

/**
 * Nominal typing over primitives: a `UserId` can never be passed where a
 * `SpaceId` is expected, even though both are strings at runtime.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };
