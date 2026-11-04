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

/** Whether applying the patch changes any value in current. Objects are compared by reference. */
export function patchChangesAnything<T extends object>(current: T, patch: Patch<T>): boolean {
  const values = asRecord(current);
  return Object.entries(patch).some(([key, value]) => (value ?? undefined) !== values[key]);
}
