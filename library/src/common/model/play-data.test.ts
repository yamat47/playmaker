import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import {
  clonePlayData,
  DEFAULT_FIELD_ZONE,
  LOS_YARD_BY_ZONE,
  type PlayData,
  resolvePlayData,
} from "./play-data.js";

describe("clonePlayData", () => {
  const source: PlayData = {
    version: 2,
    field: { zone: "redzone", losYard: 85 },
    players: [
      {
        id: "qb",
        position: { lateralYard: 26, downfieldYard: 48 },
        shape: "circle",
        label: "QB",
        color: "#f00",
      },
    ],
    lines: [
      {
        id: "r1",
        kind: "route",
        startPlayerId: "qb",
        waypoints: [{ lateralYard: 30, downfieldYard: 52 }],
        end: { lateralYard: 35, downfieldYard: 60 },
        interpolation: "bezier",
      },
    ],
  };

  it("returns an independent deep copy with equal values", () => {
    const copy = clonePlayData(source);

    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy.field).not.toBe(source.field);
    expect(copy.players[0]).not.toBe(source.players[0]);
    expect(copy.lines[0]).not.toBe(source.lines[0]);
    expect(copy.lines[0]?.waypoints[0]).not.toBe(source.lines[0]?.waypoints[0]);
  });

  it("leaves the source untouched when the copy is modified", () => {
    const copy = mutable(clonePlayData(source));

    copy.field.zone = "middle";
    must(copy.players[0]).label = "WR";
    must(copy.lines[0]).waypoints.push({ lateralYard: 0, downfieldYard: 0 });

    expect(source.field.zone).toBe("redzone");
    expect(source.players[0]?.label).toBe("QB");
    expect(source.lines[0]?.waypoints).toHaveLength(1);
  });
});

describe("resolvePlayData", () => {
  it("returns empty data with the default zone and no players or lines for undefined", () => {
    expect(resolvePlayData(undefined)).toEqual({
      version: 2,
      field: { zone: DEFAULT_FIELD_ZONE, losYard: 50 },
      players: [],
      lines: [],
    });
  });

  it("keeps a valid zone", () => {
    const input: PlayData = {
      version: 2,
      field: { zone: "redzone", losYard: 85 },
      players: [],
      lines: [],
    };

    expect(resolvePlayData(input).field.zone).toBe("redzone");
  });

  it("returns new objects that share nothing with the input", () => {
    const input: PlayData = {
      version: 2,
      field: { zone: "own-redzone", losYard: 10 },
      players: [],
      lines: [],
    };

    const resolved = resolvePlayData(input);

    expect(resolved).not.toBe(input);
    expect(resolved.field).not.toBe(input.field);
    expect(resolved.players).not.toBe(input.players);
    expect(resolved.lines).not.toBe(input.lines);
    expect(resolved.field.zone).toBe("own-redzone");
  });

  it("sets losYard to the zone's default instead of the input value", () => {
    const resolved = resolvePlayData({ field: { zone: "redzone", losYard: 30 } });

    expect(resolved.field).toEqual({ zone: "redzone", losYard: LOS_YARD_BY_ZONE.redzone });
  });

  it("falls back to the default zone when the zone is invalid or missing", () => {
    const broken = { version: 2, field: { zone: "bogus" } } as unknown as PlayData;
    const missingField = { version: 2 } as unknown as PlayData;

    expect(resolvePlayData(broken).field.zone).toBe(DEFAULT_FIELD_ZONE);
    expect(resolvePlayData(missingField).field.zone).toBe(DEFAULT_FIELD_ZONE);
  });

  it("normalizes the players without sharing the input elements", () => {
    const input = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [{ id: "qb", position: { lateralYard: 26, downfieldYard: 48 }, shape: "square" }],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players).toEqual([
      {
        id: "qb",
        position: { lateralYard: 26, downfieldYard: 48 },
        shape: "square",
        label: "",
      },
    ]);
    expect(resolved.players[0]).not.toBe(input.players[0]);
  });

  it("falls back to an empty array when players is missing or invalid", () => {
    const missing = { version: 2, field: { zone: "middle", losYard: 50 } } as unknown as PlayData;
    const broken = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: "nope",
    } as unknown as PlayData;

    expect(resolvePlayData(missing).players).toEqual([]);
    expect(resolvePlayData(broken).players).toEqual([]);
  });

  it("normalizes the lines and keeps only those starting from a kept player", () => {
    const input = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [{ id: "wr", position: { lateralYard: 5, downfieldYard: 50 } }],
      lines: [
        {
          id: "r1",
          kind: "route",
          startPlayerId: "wr",
          end: { lateralYard: 5, downfieldYard: 60 },
        },
        // Dropped because its start player does not exist.
        {
          id: "r2",
          kind: "route",
          startPlayerId: "ghost",
          end: { lateralYard: 0, downfieldYard: 0 },
        },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.lines.map((l) => l.id)).toEqual(["r1"]);
    expect(resolved.lines[0]).not.toBe(input.lines[0]);
  });

  it("renames the later duplicate player id and attaches its lines to the first player", () => {
    const input = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "wr", position: { lateralYard: 5, downfieldYard: 50 } },
        { id: "wr", position: { lateralYard: 9, downfieldYard: 50 } },
      ],
      lines: [{ id: "r1", startPlayerId: "wr", end: { lateralYard: 5, downfieldYard: 60 } }],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players.map((p) => [p.id, p.position.lateralYard])).toEqual([
      ["wr", 5],
      ["wr-2", 9],
    ]);
    expect(resolved.lines.map((l) => l.startPlayerId)).toEqual(["wr"]);
  });

  it("keeps a renamed id clear of the other ids given in the input", () => {
    const input = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "a", position: { lateralYard: 1, downfieldYard: 50 } },
        { id: "a", position: { lateralYard: 2, downfieldYard: 50 } },
        { id: "a-2", position: { lateralYard: 3, downfieldYard: 50 } },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players.map((p) => p.id)).toEqual(["a", "a-3", "a-2"]);
  });

  it("renames a filled-in id when it collides with an explicit id", () => {
    // The second player (index 1) has no id and gets p1, but the first already holds p1.
    const input = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "p1", position: { lateralYard: 1, downfieldYard: 50 } },
        { position: { lateralYard: 2, downfieldYard: 50 } },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players.map((p) => p.id)).toEqual(["p1", "p1-2"]);
  });

  it("renames the later duplicate line id", () => {
    const input = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [{ id: "wr", position: { lateralYard: 5, downfieldYard: 50 } }],
      lines: [
        { id: "r", startPlayerId: "wr", end: { lateralYard: 5, downfieldYard: 60 } },
        { id: "r", startPlayerId: "wr", end: { lateralYard: 9, downfieldYard: 60 } },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.lines.map((l) => l.id)).toEqual(["r", "r-2"]);
  });

  it("falls back to an empty array when lines is missing or invalid", () => {
    const missing = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [],
    } as unknown as PlayData;
    const broken = {
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [],
      lines: "nope",
    } as unknown as PlayData;

    expect(resolvePlayData(missing).lines).toEqual([]);
    expect(resolvePlayData(broken).lines).toEqual([]);
  });
});
