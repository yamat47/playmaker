import { isRecord } from "../model/guards.js";

type OptionalKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * A patch that replaces only the specified keys. Unspecified keys keep their current values.
 * Only optional keys accept null, which removes the value and restores the default.
 */
export type Patch<T> = {
  readonly [K in keyof T]?: K extends OptionalKeys<T> ? T[K] | null : T[K];
};

// Line and Player are interfaces without an index signature, so their keys cannot be looked up
// by string as is. To write the patch rules in one place without depending on the list of keys,
// the view is changed only inside these two functions.
function asRecord(value: object): Readonly<Record<string, unknown>> {
  return value as Record<string, unknown>;
}

/** Returns a new object with the patch applied to current. Does not modify current. */
export function applyPatch<T extends object>(current: T, patch: Patch<T>): T {
  const next = { ...asRecord(current) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  // Patch<T> types each value to match the key's type in T, so the patched result is also a T.
  return next as T;
}

// A position, or a list of positions, is written anew by every drag even where it ends up equal,
// so values are compared by content rather than by reference.
function isSameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isSameValue(item, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => isSameValue(a[k], b[k]));
  }
  return a === b;
}

/** Whether applying the patch changes any value in current. Values are compared by content. */
export function patchChangesAnything<T extends object>(current: T, patch: Patch<T>): boolean {
  const values = asRecord(current);
  return Object.entries(patch).some(
    ([key, value]) => !isSameValue(value ?? undefined, values[key]),
  );
}
