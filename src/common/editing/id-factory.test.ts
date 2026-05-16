import { describe, expect, it } from "vitest";
import { IdFactory } from "./id-factory.js";

describe("IdFactory", () => {
  it("taken が空なら prefix-1 を返す", () => {
    const factory = new IdFactory();

    expect(factory.next("player", new Set())).toBe("player-1");
  });

  it("連続呼び出しで単調増加した id を返す", () => {
    const factory = new IdFactory();

    expect(factory.next("line", new Set())).toBe("line-1");
    expect(factory.next("line", new Set())).toBe("line-2");
    expect(factory.next("line", new Set())).toBe("line-3");
  });

  it("taken に含まれる候補を飛ばして未使用 id を返す", () => {
    const factory = new IdFactory();

    expect(factory.next("p", new Set(["p-1", "p-2"]))).toBe("p-3");
  });

  it("prefix ごとにカウンタが独立する", () => {
    const factory = new IdFactory();

    expect(factory.next("player", new Set())).toBe("player-1");
    expect(factory.next("line", new Set())).toBe("line-1");
    expect(factory.next("player", new Set())).toBe("player-2");
  });

  it("一度払い出した番号は taken から消えても再利用しない", () => {
    const factory = new IdFactory();

    // p-1 を採番 → その要素を削除（taken から外れる）しても次は p-2。
    expect(factory.next("p", new Set())).toBe("p-1");
    expect(factory.next("p", new Set())).toBe("p-2");
  });
});
