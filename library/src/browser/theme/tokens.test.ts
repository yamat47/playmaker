import { describe, expect, it, vi } from "vitest";
import { THEME_TOKENS, themeReaderFrom } from "./tokens.js";

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

describe("themeReaderFrom", () => {
  it("宣言された値は、前後の空白を除いて返す", () => {
    const theme = themeReaderFrom(() => "  #123456 ");

    expect(theme("playerFill")).toBe("#123456");
  });

  it("宣言されていない変数は、トークンの既定値で描く", () => {
    const theme = themeReaderFrom(() => "");

    expect(theme("playerFill")).toBe(THEME_TOKENS.playerFill.fallback);
  });

  it("空白だけの値は、宣言されていないものとして既定値で描く", () => {
    const theme = themeReaderFrom(() => "   ");

    expect(theme("lineRoute")).toBe(THEME_TOKENS.lineRoute.fallback);
  });

  it("トークンに対応するテーマ変数の名前で値を読む", () => {
    const read = vi.fn((_property: string) => "#000000");

    themeReaderFrom(read)("selection");

    expect(read).toHaveBeenCalledExactlyOnceWith("--playmaker-selection");
  });
});
