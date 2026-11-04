import { describe, expect, it } from "vitest";
import { FIELD_FONT_FAMILY, fieldFont } from "./field-font.js";

describe("FIELD_FONT_FAMILY", () => {
  it("puts the bundled font first and falls back to generic sans-serif for missing glyphs", () => {
    const families = FIELD_FONT_FAMILY.split(",").map((family) => family.trim());

    expect(families).toEqual(['"Playmaker Saira"', "sans-serif"]);
  });
});

describe("fieldFont", () => {
  it("builds the ctx.font value from the bundled font weight and the given px size", () => {
    expect(fieldFont(12)).toBe('700 12px "Playmaker Saira", sans-serif');
  });
});
