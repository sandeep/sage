// src/lib/types/errors.ts

/** Returned by logic functions when required data is absent. */
export const NO_DATA = Symbol('NO_DATA');
export type NoData = typeof NO_DATA;

/** Wraps a value that may be absent due to missing data. */
export type DataResult<T> = T | null;
