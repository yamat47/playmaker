export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A string of only whitespace also counts as empty. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isOneOf<const T extends string>(value: unknown, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}

/**
 * Reads only the first `max` entries of the array and drops those for which `parse` returns null.
 * Unrecoverable entries also count toward the number read, so at most `max` entries are ever
 * read for any input.
 */
export function parseBoundedArray<T>(
  raw: unknown,
  max: number,
  parse: (entry: unknown, index: number) => T | null,
): T[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: T[] = [];
  const end = Math.min(raw.length, max);
  for (let index = 0; index < end; index += 1) {
    const value = parse(raw[index], index);
    if (value !== null) {
      parsed.push(value);
    }
  }
  return parsed;
}
