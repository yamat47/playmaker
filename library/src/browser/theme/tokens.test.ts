import { describe, expect, it } from "vitest";
import { THEME_TOKENS } from "./tokens.js";

describe("THEME_TOKENS", () => {
  it("テーマ変数の名前は重ならない", () => {
    const properties = Object.values(THEME_TOKENS).map((token) => token.property);

    expect(new Set(properties).size).toBe(properties.length);
  });

  it("テーマ変数の名前は --playmaker- の後に小文字の単語をハイフンでつないだ形になっている", () => {
    for (const { property } of Object.values(THEME_TOKENS)) {
      expect(property).toMatch(/^--playmaker-[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
