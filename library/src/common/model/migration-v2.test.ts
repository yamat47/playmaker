import { describe, expect, it } from "vitest";
import { MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { migrateV1ToV2 } from "./migration-v2.js";
import { MAX_PLAYERS } from "./player.js";

describe("migrateV1ToV2", () => {
  it("subtracts the zone's LOS from the absolute yards of players, waypoints, and ends", () => {
    const v1 = {
      version: 1,
      field: { zone: "redzone" },
      players: [{ id: "qb", position: { lateralYard: 26, absoluteYard: 80 } }],
      lines: [
        {
          id: "r",
          startPlayerId: "qb",
          waypoints: [{ lateralYard: 26, absoluteYard: 90 }],
          end: { lateralYard: 30, absoluteYard: 95 },
        },
      ],
    };

    const v2 = migrateV1ToV2(v1);

    expect(v2.field).toEqual({ zone: "redzone", losYard: 85 });
    expect(v2.players).toEqual([{ id: "qb", position: { lateralYard: 26, downfieldYard: -5 } }]);
    expect(v2.lines).toEqual([
      {
        id: "r",
        startPlayerId: "qb",
        waypoints: [{ lateralYard: 26, downfieldYard: 5 }],
        end: { lateralYard: 30, downfieldYard: 10 },
      },
    ]);
  });

  it("uses the default zone's LOS when the zone cannot be read", () => {
    const v2 = migrateV1ToV2({
      field: "middle",
      players: [{ position: { lateralYard: 1, absoluteYard: 52 } }],
    });

    expect(v2.field).toEqual({ zone: "middle", losYard: 50 });
    expect(v2.players).toEqual([{ position: { lateralYard: 1, downfieldYard: 2 } }]);
    const unknownZone = migrateV1ToV2({ field: { zone: "bogus" } });
    expect(unknownZone.field).toEqual({ zone: "middle", losYard: 50 });
  });

  it("leaves malformed values as they are and lets normalization decide to drop them", () => {
    const v2 = migrateV1ToV2({
      field: { zone: "middle" },
      players: [null, { position: { lateralYard: 1, absoluteYard: "x" } }],
      lines: [7, { waypoints: "none", end: null }],
    });

    expect(v2.players).toEqual([null, { position: { lateralYard: 1, absoluteYard: "x" } }]);
    expect(v2.lines).toEqual([7, { waypoints: "none", end: null }]);
  });

  it("leaves non-array players and lines as they are", () => {
    const v2 = migrateV1ToV2({ field: { zone: "middle" }, players: "p", lines: 3 });

    expect(v2.players).toBe("p");
    expect(v2.lines).toBe(3);
  });

  it("converts players, lines, and waypoints only up to the normalization limits", () => {
    const point = { lateralYard: 1, absoluteYard: 50 };
    const v2 = migrateV1ToV2({
      field: { zone: "middle" },
      players: Array.from({ length: MAX_PLAYERS + 3 }, () => ({ position: point })),
      lines: Array.from({ length: MAX_LINES + 3 }, () => ({
        waypoints: Array.from({ length: MAX_WAYPOINTS_PER_LINE + 3 }, () => point),
      })),
    });

    expect(v2.players).toHaveLength(MAX_PLAYERS);
    expect(v2.lines).toHaveLength(MAX_LINES);
    expect(v2.lines).toContainEqual(
      expect.objectContaining({
        waypoints: Array.from({ length: MAX_WAYPOINTS_PER_LINE }, () => ({
          lateralYard: 1,
          downfieldYard: 0,
        })),
      }),
    );
  });
});
