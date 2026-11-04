import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import type { IIdFactory } from "../model/id-factory.js";
import { type Formation, instantiateFormation, normalizeFormation } from "./formation.js";

describe("normalizeFormation: unrecoverable input", () => {
  it("returns null for a non-object or null", () => {
    expect(normalizeFormation("formation")).toBeNull();
    expect(normalizeFormation(42)).toBeNull();
    expect(normalizeFormation(null)).toBeNull();
  });

  it("returns null when no player can be placed (non-array players or every entry invalid)", () => {
    expect(normalizeFormation({ id: "x", name: "X", side: "offense" })).toBeNull();
    expect(normalizeFormation({ players: "nope" })).toBeNull();
    expect(normalizeFormation({ players: [{ shape: "circle" }] })).toBeNull(); // no position
  });
});

describe("normalizeFormation: defaults", () => {
  it("defaults a missing or blank id, name, and side, and drops the id from players", () => {
    const result = must(
      normalizeFormation({
        // id is blank, name is absent, and side is an unknown value, so all three get defaults.
        id: "   ",
        side: "kickoff",
        players: [{ id: "should-be-dropped", position: { lateralYard: 5, downfieldYard: 50 } }],
      }),
    );

    expect(result.id).toBe("formation");
    expect(result.name).toBe("Formation");
    expect(result.side).toBe("offense");
    // FormationPlayer has no id (normalizePlayers fills in the shape and label defaults).
    expect(result.players).toEqual([
      { position: { lateralYard: 5, downfieldYard: 50 }, shape: "circle", label: "" },
    ]);
    expect("id" in must(result.players[0])).toBe(false);
  });

  it("keeps the given id, name, and side, and carries color and fill only when present", () => {
    const result = must(
      normalizeFormation({
        id: "nickel",
        name: "Nickel",
        side: "defense",
        players: [
          {
            position: { lateralYard: 7, downfieldYard: 53 },
            shape: "square",
            color: "#c62828",
            fill: "solid",
          },
          { position: { lateralYard: 46, downfieldYard: 53 }, shape: "square" },
        ],
      }),
    );

    expect(result.id).toBe("nickel");
    expect(result.name).toBe("Nickel");
    expect(result.side).toBe("defense");
    expect(must(result.players[0])).toMatchObject({ color: "#c62828", fill: "solid" });
    expect("color" in must(result.players[1])).toBe(false);
    expect("fill" in must(result.players[1])).toBe(false);
  });

  it("returns a copy detached from the input (changing a position does not propagate)", () => {
    const input = {
      players: [{ position: { lateralYard: 1, downfieldYard: 2 } }],
    };
    const result = must(normalizeFormation(input));

    must(input.players[0]).position.lateralYard = 999;

    expect(must(result.players[0]).position.lateralYard).toBe(1);
  });
});

describe("instantiateFormation", () => {
  const formation: Formation = {
    id: "pair",
    name: "Two players",
    side: "offense",
    players: [
      { position: { lateralYard: 1, downfieldYard: 0 }, shape: "circle", label: "A" },
      { position: { lateralYard: 2, downfieldYard: 0 }, shape: "square", label: "B" },
    ],
  };

  it("returns players with ids assigned in template order", () => {
    let n = 0;
    const ids: IIdFactory = { next: () => `id-${++n}` };

    expect(instantiateFormation(formation, ids, [])).toEqual([
      { ...formation.players[0], id: "id-1" },
      { ...formation.players[1], id: "id-2" },
    ]);
  });

  it("avoids both the existing ids and the ids assigned earlier in the same call", () => {
    const seen: string[][] = [];
    const ids: IIdFactory = {
      next: (_, taken) => {
        seen.push([...taken].sort());
        return `id-${seen.length}`;
      },
    };

    instantiateFormation(formation, ids, ["x"]);

    expect(seen).toEqual([["x"], ["id-1", "x"]]);
  });
});
