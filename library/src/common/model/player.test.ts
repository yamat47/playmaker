import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import {
  clonePlayer,
  DEFAULT_PLAYER_SHAPE,
  MAX_PLAYERS,
  normalizePlayers,
  type Player,
  parseFieldPosition,
} from "./player.js";

describe("normalizePlayers", () => {
  it("keeps a valid player as is and fills missing fields with defaults", () => {
    const result = normalizePlayers([
      { id: "qb", position: { lateralYard: 26, downfieldYard: 48 }, shape: "square", label: "QB" },
      { id: "wr", position: { lateralYard: 5, downfieldYard: 50 } },
    ]);

    expect(result).toEqual([
      { id: "qb", position: { lateralYard: 26, downfieldYard: 48 }, shape: "square", label: "QB" },
      {
        id: "wr",
        position: { lateralYard: 5, downfieldYard: 50 },
        shape: DEFAULT_PLAYER_SHAPE,
        label: "",
      },
    ]);
  });

  it("replaces a shape other than circle or square with the default shape", () => {
    const [player] = normalizePlayers([
      { id: "de", position: { lateralYard: 1, downfieldYard: 2 }, shape: "triangle" },
    ]);

    expect(player?.shape).toBe(DEFAULT_PLAYER_SHAPE);
  });

  it("keeps color only as a non-empty string", () => {
    const [withColor, blankColor] = normalizePlayers([
      { id: "a", position: { lateralYard: 1, downfieldYard: 2 }, color: "#ff0000" },
      { id: "b", position: { lateralYard: 1, downfieldYard: 2 }, color: "   " },
    ]);

    expect(withColor?.color).toBe("#ff0000");
    expect(blankColor && "color" in blankColor).toBe(false);
  });

  it("keeps fill only as outline or solid", () => {
    const result = normalizePlayers([
      { id: "a", position: { lateralYard: 1, downfieldYard: 2 }, fill: "solid" },
      { id: "b", position: { lateralYard: 1, downfieldYard: 2 }, fill: "hatched" },
    ]);

    expect(result[0]?.fill).toBe("solid");
    expect("fill" in must(result[1])).toBe(false);
  });

  it("returns an empty array for a non-array input", () => {
    expect(normalizePlayers(undefined)).toEqual([]);
    expect(normalizePlayers(null)).toEqual([]);
    expect(normalizePlayers({ length: 1 })).toEqual([]);
  });

  it("drops an element whose position is missing, non-numeric, or not an object", () => {
    const result = normalizePlayers([
      null,
      "player",
      { id: "no-pos" },
      { id: "nan", position: { lateralYard: Number.NaN, downfieldYard: 0 } },
      { id: "infinite", position: { lateralYard: 0, downfieldYard: Number.POSITIVE_INFINITY } },
      { id: "str", position: { lateralYard: "1", downfieldYard: 2 } },
      { id: "ok", position: { lateralYard: 1, downfieldYard: 2 } },
    ]);

    expect(result.map((p) => p.id)).toEqual(["ok"]);
  });

  it("assigns a deterministic id from the index when the id is missing or blank", () => {
    const result = normalizePlayers([
      { position: { lateralYard: 0, downfieldYard: 0 } },
      { id: "  ", position: { lateralYard: 0, downfieldYard: 0 } },
    ]);

    expect(result.map((p) => p.id)).toEqual(["p0", "p1"]);
  });

  it("returns new objects that share no array, element, or position with the input", () => {
    const input = [{ id: "a", position: { lateralYard: 1, downfieldYard: 2 } }];

    const [normalized] = normalizePlayers(input);

    expect(normalized).not.toBe(input[0]);
    expect(normalized?.position).not.toBe(input[0]?.position);
  });
});

describe("normalizePlayers limits", () => {
  const at = (i: number) => ({ id: `p${i}`, position: { lateralYard: 5, downfieldYard: i } });

  it("keeps only the first MAX_PLAYERS players when more are given", () => {
    const raw = Array.from({ length: MAX_PLAYERS + 5 }, (_, i) => at(i));

    const players = normalizePlayers(raw);

    expect(players).toHaveLength(MAX_PLAYERS);
    expect(players.at(-1)?.id).toBe(`p${MAX_PLAYERS - 1}`);
  });

  it("returns fewer players when the first MAX_PLAYERS elements include unusable ones", () => {
    const raw = [null, ...Array.from({ length: MAX_PLAYERS }, (_, i) => at(i))];

    expect(normalizePlayers(raw)).toHaveLength(MAX_PLAYERS - 1);
  });

  it("reads nothing past the first MAX_PLAYERS elements of a long sparse array", () => {
    const sparse: unknown[] = [];
    sparse.length = 2 ** 32 - 1;
    sparse[MAX_PLAYERS] = at(0);

    expect(normalizePlayers(sparse)).toEqual([]);
  });
});

describe("parseFieldPosition", () => {
  it("returns a new position from an object with finite coordinates", () => {
    const raw = { lateralYard: 5, downfieldYard: 50, extra: true };

    const position = parseFieldPosition(raw);

    expect(position).toEqual({ lateralYard: 5, downfieldYard: 50 });
    expect(position).not.toBe(raw);
  });

  it("returns null when a coordinate is missing or not a number", () => {
    expect(parseFieldPosition({ lateralYard: 5 })).toBeNull();
    expect(parseFieldPosition({ lateralYard: "5", downfieldYard: 50 })).toBeNull();
    expect(parseFieldPosition({ lateralYard: 5, downfieldYard: Number.NaN })).toBeNull();
  });

  it("returns null for a non-object", () => {
    expect(parseFieldPosition(null)).toBeNull();
    expect(parseFieldPosition("5,50")).toBeNull();
  });
});

describe("clonePlayer", () => {
  it("copies the position without sharing it with the original", () => {
    const original: Player = {
      id: "x",
      position: { lateralYard: 3, downfieldYard: 4 },
      shape: "square",
      label: "X",
      color: "#00f",
    };

    const copy = clonePlayer(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.position).not.toBe(original.position);
  });

  it("leaves color out of the copy when the original has none", () => {
    const copy = clonePlayer({
      id: "x",
      position: { lateralYard: 0, downfieldYard: 0 },
      shape: "circle",
      label: "",
    });

    expect("color" in copy).toBe(false);
  });
});
