import { describe, expect, it } from "vitest";
import { LINE_COLOR_PALETTE } from "./line-palette.js";
import { THEME_TOKENS } from "./tokens.js";

describe("LINE_COLOR_PALETTE", () => {
  it("既定色はどれも、color input が受け付ける 6 桁の hex になっている", () => {
    for (const option of LINE_COLOR_PALETTE) {
      expect(THEME_TOKENS[option.token].fallback).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("色ごとに別のテーマ変数を持ち、表示名も重ならない", () => {
    const tokens = LINE_COLOR_PALETTE.map((option) => option.token);
    const labels = LINE_COLOR_PALETTE.map((option) => option.label);

    expect(new Set(tokens).size).toBe(tokens.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
