import { describe, expect, it } from "vitest";
import { MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { migrateV1ToV2, V1_DEFAULT_THICKNESS_PX } from "./migration-v2.js";
import { MAX_PLAYERS } from "./player.js";

describe("migrateV1ToV2", () => {
  it("選手、waypoint、終点の絶対ヤードから、そのゾーンの LOS を引く", () => {
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

  it("線の太さの px を、v1 の既定の太さに対する倍率へ直す", () => {
    const v2 = migrateV1ToV2({
      field: { zone: "middle" },
      lines: [{ thickness: V1_DEFAULT_THICKNESS_PX * 2 }],
    });

    expect(v2.lines).toEqual([expect.objectContaining({ thickness: 2 })]);
  });

  it("ゾーンが読めなければ既定のゾーンの LOS で直す", () => {
    const v2 = migrateV1ToV2({
      field: "middle",
      players: [{ position: { lateralYard: 1, absoluteYard: 52 } }],
    });

    expect(v2.field).toEqual({ zone: "middle", losYard: 50 });
    expect(v2.players).toEqual([{ position: { lateralYard: 1, downfieldYard: 2 } }]);
    const unknownZone = migrateV1ToV2({ field: { zone: "bogus" } });
    expect(unknownZone.field).toEqual({ zone: "middle", losYard: 50 });
  });

  it("形が崩れた値は直さずにそのまま残し、捨てるかどうかは正規化に任せる", () => {
    const v2 = migrateV1ToV2({
      field: { zone: "middle" },
      players: [null, { position: { lateralYard: 1, absoluteYard: "x" } }],
      lines: [7, { waypoints: "none", end: null, thickness: "thick" }],
    });

    expect(v2.players).toEqual([null, { position: { lateralYard: 1, absoluteYard: "x" } }]);
    expect(v2.lines).toEqual([7, { waypoints: "none", end: null, thickness: "thick" }]);
  });

  it("配列でない players と lines はそのまま残す", () => {
    const v2 = migrateV1ToV2({ field: { zone: "middle" }, players: "p", lines: 3 });

    expect(v2.players).toBe("p");
    expect(v2.lines).toBe(3);
  });

  it("選手、線、waypoint は正規化と同じ上限の個数までしか直さない", () => {
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
