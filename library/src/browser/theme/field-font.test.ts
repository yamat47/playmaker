import { describe, expect, it } from "vitest";
import { FIELD_FONT_FAMILY } from "./field-font.js";

describe("FIELD_FONT_FAMILY", () => {
  it("同梱フォントを先頭に置き、収録していない字は総称の sans-serif で描く", () => {
    const families = FIELD_FONT_FAMILY.split(",").map((family) => family.trim());

    expect(families).toEqual(['"Playmaker Saira"', "sans-serif"]);
  });
});
