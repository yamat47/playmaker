type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

/**
 * Strips readonly from a type. A JavaScript consumer can modify a value the types forbid changing,
 * so tests that verify defensive copies use this to modify inputs and return values.
 */
export function mutable<T>(value: T): DeepMutable<T> {
  return value as DeepMutable<T>;
}
