import { describe, expect, it, vi } from "vitest";
import { THEME_TOKENS, themeReaderFrom } from "./tokens.js";

describe("THEME_TOKENS", () => {
  it("gives every theme variable a distinct name", () => {
    const properties = Object.values(THEME_TOKENS).map((token) => token.property);

    expect(new Set(properties).size).toBe(properties.length);
  });

  it("names every theme variable --playmaker- followed by lowercase hyphenated words", () => {
    for (const { property } of Object.values(THEME_TOKENS)) {
      expect(property).toMatch(/^--playmaker-[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("themeReaderFrom", () => {
  it("returns a declared value with surrounding whitespace trimmed", () => {
    const theme = themeReaderFrom(() => "  #123456 ");

    expect(theme("playerColor")).toBe("#123456");
  });

  it("falls back to the token default when the variable is not declared", () => {
    const theme = themeReaderFrom(() => "");

    expect(theme("playerColor")).toBe(THEME_TOKENS.playerColor.fallback);
  });

  it("treats a whitespace-only value as undeclared and falls back to the default", () => {
    const theme = themeReaderFrom(() => "   ");

    expect(theme("lineRoute")).toBe(THEME_TOKENS.lineRoute.fallback);
  });

  it("reads the value by the theme variable name that belongs to the token", () => {
    const read = vi.fn((_property: string) => "#000000");

    themeReaderFrom(read)("selection");

    expect(read).toHaveBeenCalledExactlyOnceWith("--playmaker-selection");
  });
});
