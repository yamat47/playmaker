import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { deepFreeze } from "./shared.js";

describe("deepFreeze", () => {
  it("入れ子のオブジェクトと配列まで凍結する", () => {
    const value = { players: [{ position: { lateralYard: 1 } }], label: null };

    deepFreeze(value);

    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.players)).toBe(true);
    expect(Object.isFrozen(must(value.players[0]).position)).toBe(true);
  });

  it("共有された子を 2 回たどっても、渡した値をそのまま返す", () => {
    const shared = { lateralYard: 1 };
    const value = [shared, shared];

    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(shared)).toBe(true);
  });

  it("プリミティブはそのまま返す", () => {
    expect(deepFreeze(3)).toBe(3);
  });
});
