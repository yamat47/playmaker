export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 空白だけの文字列も空とみなす。 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isOneOf<const T extends string>(value: unknown, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}

/**
 * 配列の先頭 `max` 個だけを読み、`parse` が null を返した要素は捨てる。
 * 復元できない要素も読んだ数に入れるので、どんな入力でも読むのは `max` 個までで済む。
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
