import { describe, expect, it } from "vitest";
import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseFieldPosition,
} from "./guards.js";

describe("isRecord", () => {
  it("オブジェクトと配列を真とする", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
  });

  it("null とプリミティブを偽とする", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(0)).toBe(false);
  });
});

describe("isFiniteNumber", () => {
  it("有限な数だけを真とする", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber("1")).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("空白以外の文字を含む文字列だけを真とする", () => {
    expect(isNonEmptyString("a")).toBe(true);
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(1)).toBe(false);
  });
});

describe("isOneOf", () => {
  const values = ["a", "b"] as const;

  it("候補に含まれる文字列を真とする", () => {
    expect(isOneOf("b", values)).toBe(true);
  });

  it("候補にない文字列と文字列以外を偽とする", () => {
    expect(isOneOf("c", values)).toBe(false);
    expect(isOneOf(undefined, values)).toBe(false);
    expect(isOneOf(0, values)).toBe(false);
  });
});

describe("parseFieldPosition", () => {
  it("有限な座標を持つオブジェクトを新しい位置として返す", () => {
    const raw = { lateralYard: 5, absoluteYard: 50, extra: true };

    const position = parseFieldPosition(raw);

    expect(position).toEqual({ lateralYard: 5, absoluteYard: 50 });
    expect(position).not.toBe(raw);
  });

  it("座標が欠けているか数でなければ null を返す", () => {
    expect(parseFieldPosition({ lateralYard: 5 })).toBeNull();
    expect(parseFieldPosition({ lateralYard: "5", absoluteYard: 50 })).toBeNull();
    expect(parseFieldPosition({ lateralYard: 5, absoluteYard: Number.NaN })).toBeNull();
  });

  it("オブジェクトでなければ null を返す", () => {
    expect(parseFieldPosition(null)).toBeNull();
    expect(parseFieldPosition("5,50")).toBeNull();
  });
});
