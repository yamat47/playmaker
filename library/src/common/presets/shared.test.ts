import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { deepFreeze } from "./shared.js";

describe("deepFreeze", () => {
  it("freezes nested objects and arrays", () => {
    const value = { players: [{ position: { lateralYard: 1 } }], label: null };

    deepFreeze(value);

    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.players)).toBe(true);
    expect(Object.isFrozen(must(value.players[0]).position)).toBe(true);
  });

  it("returns the given value even when a shared child is visited twice", () => {
    const shared = { lateralYard: 1 };
    const value = [shared, shared];

    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(shared)).toBe(true);
  });

  it("returns a primitive unchanged", () => {
    expect(deepFreeze(3)).toBe(3);
  });
});
