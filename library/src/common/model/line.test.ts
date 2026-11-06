import { describe, expect, it } from "vitest";
import { player } from "../../test-support/fixtures.js";
import {
  cloneLine,
  DEFAULT_LINE_INTERPOLATION,
  DEFAULT_LINE_KIND,
  indexPlayersById,
  type Line,
  lineAnchorPoints,
  MAX_LINES,
  MAX_WAYPOINTS_PER_LINE,
  normalizeLines,
} from "./line.js";

const PLAYER_IDS = new Set(["qb", "wr"]);

describe("normalizeLines", () => {
  it("keeps a valid line as is and fills missing fields with defaults", () => {
    const result = normalizeLines(
      [
        {
          id: "r1",
          kind: "route",
          startPlayerId: "wr",
          waypoints: [{ lateralYard: 10, downfieldYard: 55 }],
          end: { lateralYard: 12, downfieldYard: 62 },
          interpolation: "bezier",
        },
        // kind, interpolation, and id are missing, so the defaults fill them.
        { startPlayerId: "qb", end: { lateralYard: 26, downfieldYard: 40 } },
      ],
      PLAYER_IDS,
    );

    expect(result).toEqual([
      {
        id: "r1",
        kind: "route",
        startPlayerId: "wr",
        waypoints: [{ lateralYard: 10, downfieldYard: 55 }],
        end: { lateralYard: 12, downfieldYard: 62 },
        interpolation: "bezier",
      },
      {
        id: "l1",
        kind: DEFAULT_LINE_KIND,
        startPlayerId: "qb",
        waypoints: [],
        end: { lateralYard: 26, downfieldYard: 40 },
        interpolation: DEFAULT_LINE_INTERPOLATION,
      },
    ]);
  });

  it("keeps color only as a non-empty string", () => {
    const [a, b] = normalizeLines(
      [
        { startPlayerId: "qb", end: { lateralYard: 1, downfieldYard: 2 }, color: "#ff0000" },
        { startPlayerId: "qb", end: { lateralYard: 1, downfieldYard: 2 }, color: "  " },
      ],
      PLAYER_IDS,
    );

    expect(a?.color).toBe("#ff0000");
    expect(b && "color" in b).toBe(false);
  });

  it("drops the thickness that earlier versions saved and keeps the line", () => {
    const [restored] = normalizeLines(
      [{ startPlayerId: "qb", end: { lateralYard: 1, downfieldYard: 2 }, thickness: 4 }],
      PLAYER_IDS,
    );

    expect(restored).toBeDefined();
    expect(restored && "thickness" in restored).toBe(false);
  });

  it("drops a line whose start player does not exist", () => {
    const result = normalizeLines(
      [
        { startPlayerId: "ghost", end: { lateralYard: 1, downfieldYard: 2 } },
        { startPlayerId: "", end: { lateralYard: 1, downfieldYard: 2 } },
        { end: { lateralYard: 1, downfieldYard: 2 } },
        { startPlayerId: "qb", end: { lateralYard: 1, downfieldYard: 2 } },
      ],
      PLAYER_IDS,
    );

    expect(result.map((l) => l.startPlayerId)).toEqual(["qb"]);
  });

  it("drops a line whose end is missing, non-numeric, or not an object", () => {
    const result = normalizeLines(
      [
        null,
        "line",
        { startPlayerId: "qb" },
        { startPlayerId: "qb", end: { lateralYard: Number.NaN, downfieldYard: 0 } },
        { startPlayerId: "qb", end: { lateralYard: 0, downfieldYard: "5" } },
        { id: "ok", startPlayerId: "qb", end: { lateralYard: 0, downfieldYard: 5 } },
      ],
      PLAYER_IDS,
    );

    expect(result.map((l) => l.id)).toEqual(["ok"]);
  });

  it("drops only the non-numeric waypoints and keeps the line", () => {
    const [line] = normalizeLines(
      [
        {
          startPlayerId: "qb",
          waypoints: [
            { lateralYard: 1, downfieldYard: 2 },
            { lateralYard: Number.POSITIVE_INFINITY, downfieldYard: 2 },
            "bad",
            { lateralYard: 3, downfieldYard: 4 },
          ],
          end: { lateralYard: 5, downfieldYard: 6 },
        },
      ],
      PLAYER_IDS,
    );

    expect(line?.waypoints).toEqual([
      { lateralYard: 1, downfieldYard: 2 },
      { lateralYard: 3, downfieldYard: 4 },
    ]);
  });

  it("replaces non-array waypoints with an empty array", () => {
    const [line] = normalizeLines(
      [{ startPlayerId: "qb", waypoints: "nope", end: { lateralYard: 0, downfieldYard: 0 } }],
      PLAYER_IDS,
    );

    expect(line?.waypoints).toEqual([]);
  });

  it("assigns a deterministic id from the index when the id is missing or blank", () => {
    const result = normalizeLines(
      [
        { startPlayerId: "qb", end: { lateralYard: 0, downfieldYard: 0 } },
        { id: "  ", startPlayerId: "qb", end: { lateralYard: 0, downfieldYard: 0 } },
      ],
      PLAYER_IDS,
    );

    expect(result.map((l) => l.id)).toEqual(["l0", "l1"]);
  });

  it("returns an empty array for a non-array input", () => {
    expect(normalizeLines(undefined, PLAYER_IDS)).toEqual([]);
    expect(normalizeLines(null, PLAYER_IDS)).toEqual([]);
    expect(normalizeLines({ length: 1 }, PLAYER_IDS)).toEqual([]);
  });

  it("returns new objects that share no array, element, or position with the input", () => {
    const input = [
      {
        startPlayerId: "qb",
        waypoints: [{ lateralYard: 1, downfieldYard: 2 }],
        end: { lateralYard: 3, downfieldYard: 4 },
      },
    ];

    const [line] = normalizeLines(input, PLAYER_IDS);

    expect(line).not.toBe(input[0]);
    expect(line?.waypoints[0]).not.toBe(input[0]?.waypoints[0]);
    expect(line?.end).not.toBe(input[0]?.end);
  });
});

describe("normalizeLines limits", () => {
  const end = { lateralYard: 5, downfieldYard: 60 };

  it("keeps only the first MAX_LINES lines when more are given", () => {
    const raw = Array.from({ length: MAX_LINES + 5 }, (_, i) => ({
      id: `l${i}`,
      startPlayerId: "qb",
      end,
    }));

    const lines = normalizeLines(raw, PLAYER_IDS);

    expect(lines).toHaveLength(MAX_LINES);
    expect(lines.at(-1)?.id).toBe(`l${MAX_LINES - 1}`);
  });

  it("keeps only the first MAX_WAYPOINTS_PER_LINE waypoints when more are given", () => {
    const waypoints = Array.from({ length: MAX_WAYPOINTS_PER_LINE + 5 }, (_, i) => ({
      lateralYard: 5,
      downfieldYard: i,
    }));

    const [line] = normalizeLines([{ startPlayerId: "qb", waypoints, end }], PLAYER_IDS);

    expect(line?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(line?.waypoints.at(-1)?.downfieldYard).toBe(MAX_WAYPOINTS_PER_LINE - 1);
  });
});

describe("cloneLine", () => {
  it("copies the waypoints and the end without sharing them with the original", () => {
    const original: Line = {
      id: "x",
      kind: "motion",
      startPlayerId: "qb",
      waypoints: [{ lateralYard: 1, downfieldYard: 2 }],
      end: { lateralYard: 3, downfieldYard: 4 },
      interpolation: "bezier",
      color: "#00f",
    };

    const copy = cloneLine(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.waypoints).not.toBe(original.waypoints);
    expect(copy.waypoints[0]).not.toBe(original.waypoints[0]);
    expect(copy.end).not.toBe(original.end);
  });

  it("leaves color out of the copy when the original has none", () => {
    const copy = cloneLine({
      id: "x",
      kind: "route",
      startPlayerId: "qb",
      waypoints: [],
      end: { lateralYard: 0, downfieldYard: 0 },
      interpolation: "straight",
    });

    expect("color" in copy).toBe(false);
  });
});

describe("lineAnchorPoints", () => {
  const players = [player("qb", 26, 48), player("wr", 5, 50)];
  const byId = indexPlayersById(players);

  it("builds [start player position, ...waypoints, end] in order", () => {
    const line: Line = {
      id: "r",
      kind: "route",
      startPlayerId: "wr",
      waypoints: [{ lateralYard: 6, downfieldYard: 55 }],
      end: { lateralYard: 7, downfieldYard: 60 },
      interpolation: "straight",
    };

    expect(lineAnchorPoints(line, byId)).toEqual([
      { lateralYard: 5, downfieldYard: 50 },
      { lateralYard: 6, downfieldYard: 55 },
      { lateralYard: 7, downfieldYard: 60 },
    ]);
  });

  it("returns undefined when the start player is not found", () => {
    const line: Line = {
      id: "r",
      kind: "route",
      startPlayerId: "missing",
      waypoints: [],
      end: { lateralYard: 0, downfieldYard: 0 },
      interpolation: "straight",
    };

    expect(lineAnchorPoints(line, byId)).toBeUndefined();
  });

  it("shares no player position or waypoint so later transforms leave the model intact", () => {
    const line: Line = {
      id: "r",
      kind: "route",
      startPlayerId: "qb",
      waypoints: [{ lateralYard: 1, downfieldYard: 2 }],
      end: { lateralYard: 3, downfieldYard: 4 },
      interpolation: "straight",
    };

    const points = lineAnchorPoints(line, byId);

    expect(points?.[0]).not.toBe(players[0]?.position);
    expect(points?.[1]).not.toBe(line.waypoints[0]);
    expect(points?.[2]).not.toBe(line.end);
  });
});

describe("indexPlayersById", () => {
  it("builds a Map keyed by id", () => {
    const a = player("a", 0, 0);
    const b = player("b", 1, 1);

    const map = indexPlayersById([a, b]);

    expect(map.get("a")).toBe(a);
    expect(map.get("b")).toBe(b);
    expect(map.get("c")).toBeUndefined();
  });

  it("lets the later player win for a duplicate id, matching the draw order", () => {
    const first = player("dup", 0, 0);
    const second = player("dup", 9, 9);

    expect(indexPlayersById([first, second]).get("dup")).toBe(second);
  });
});
