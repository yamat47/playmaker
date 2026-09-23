import { describe, expect, it } from "vitest";
import { isHexColor } from "./color.js";

describe("isHexColor", () => {
  it("# に続く 6 桁の hex は、大文字でも小文字でも true", () => {
    expect(isHexColor("#2b4c72")).toBe(true);
    expect(isHexColor("#C49A3C")).toBe(true);
  });

  it("3 桁と 8 桁の hex は false", () => {
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("#2b4c72ff")).toBe(false);
  });

  it("hex 以外の書き方の色は false", () => {
    expect(isHexColor("rgb(43, 76, 114)")).toBe(false);
    expect(isHexColor("navy")).toBe(false);
    expect(isHexColor("2b4c72")).toBe(false);
  });
});
