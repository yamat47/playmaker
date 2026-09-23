import { describe, expect, it } from "vitest";
import { LINE_COLOR_PALETTE } from "./line-palette.js";

describe("LINE_COLOR_PALETTE", () => {
  it("既定色はどれも、color input が受け付ける 6 桁の hex になっている", () => {
    for (const option of LINE_COLOR_PALETTE) {
      expect(option.fallback).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("どの色もライブラリのテーマ変数に紐づき、表示名は重ならない", () => {
    for (const option of LINE_COLOR_PALETTE) {
      expect(option.cssVar).toMatch(/^--playmaker-/);
    }
    const labels = LINE_COLOR_PALETTE.map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
