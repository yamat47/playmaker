import { describe, expect, it } from "vitest";
import { IdFactory } from "./id-factory.js";

describe("IdFactory", () => {
  it("returns prefix-1 when taken is empty", () => {
    const factory = new IdFactory();

    expect(factory.next("player", new Set())).toBe("player-1");
  });

  it("skips a number it already handed out even when taken does not contain it", () => {
    const factory = new IdFactory();

    expect(factory.next("line", new Set())).toBe("line-1");
    expect(factory.next("line", new Set())).toBe("line-2");
    expect(factory.next("line", new Set())).toBe("line-3");
  });

  it("skips the candidates in taken and returns an unused id", () => {
    const factory = new IdFactory();

    expect(factory.next("p", new Set(["p-1", "p-2"]))).toBe("p-3");
  });

  it("keeps a separate counter per prefix", () => {
    const factory = new IdFactory();

    expect(factory.next("player", new Set())).toBe("player-1");
    expect(factory.next("line", new Set())).toBe("line-1");
    expect(factory.next("player", new Set())).toBe("player-2");
  });
});
