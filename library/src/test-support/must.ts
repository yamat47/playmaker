/** Narrows a value from noUncheckedIndexedAccess or a null-returning API without `!`. */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}
