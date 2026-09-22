import { describe, expect, it, vi } from "vitest";
import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseBoundedArray,
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

describe("parseBoundedArray", () => {
  const parseNumber = (entry: unknown) => (typeof entry === "number" ? entry : null);

  it("配列でなければ空配列を返す", () => {
    expect(parseBoundedArray("1,2", 10, parseNumber)).toEqual([]);
    expect(parseBoundedArray(undefined, 10, parseNumber)).toEqual([]);
  });

  it("parse が null を返した要素を捨てる", () => {
    expect(parseBoundedArray([1, "x", 2], 10, parseNumber)).toEqual([1, 2]);
  });

  it("先頭の max 個だけを読み、捨てた要素も読んだ数に入れる", () => {
    expect(parseBoundedArray(["x", 1, 2, 3], 3, parseNumber)).toEqual([1, 2]);
  });

  it("parse に要素の位置を渡す", () => {
    expect(parseBoundedArray(["a", "b"], 10, (_, index) => index)).toEqual([0, 1]);
  });

  it("穴のある長い配列でも max 個しか読まない", () => {
    const sparse: unknown[] = [];
    sparse.length = 2 ** 32 - 1;
    const parse = vi.fn(parseNumber);

    parseBoundedArray(sparse, 5, parse);

    expect(parse).toHaveBeenCalledTimes(5);
  });
});
