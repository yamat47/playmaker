import { describe, expect, it } from "vitest";
import { ja } from "../i18n/ja.js";
import { en } from "../i18n/messages.js";
import { SWATCH_TOKENS } from "./palette.js";
import { THEME_TOKENS } from "./tokens.js";

describe("SWATCH_TOKENS", () => {
  it("every default color is a lowercase #rrggbb that compares with a saved color as a string", () => {
    for (const token of SWATCH_TOKENS) {
      expect(THEME_TOKENS[token].fallback).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each([
    ["en", en],
    ["ja", ja],
  ])("names each color differently in %s", (_, messages) => {
    const names = SWATCH_TOKENS.map((token) => messages.colors[token]);

    expect(new Set(names).size).toBe(names.length);
  });
});
