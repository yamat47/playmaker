import type { FieldPosition } from "./player.js";

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

/** 座標が有限な数でなければ復元できないので null を返す。返す位置は入力と共有しない。 */
export function parseFieldPosition(raw: unknown): FieldPosition | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { lateralYard, absoluteYard } = raw;
  if (!isFiniteNumber(lateralYard) || !isFiniteNumber(absoluteYard)) {
    return null;
  }
  return { lateralYard, absoluteYard };
}
