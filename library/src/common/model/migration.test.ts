import { describe, expect, it } from "vitest";
import {
  applyPlayDataMigrations,
  migratePlayData,
  type PlayDataMigration,
  readDeclaredVersion,
} from "./migration.js";
import { CURRENT_PLAY_DATA_VERSION, type PlayData } from "./play-data.js";

describe("readDeclaredVersion", () => {
  it("returns a finite version as is", () => {
    expect(readDeclaredVersion({ version: 1 })).toBe(1);
    expect(readDeclaredVersion({ version: 2 })).toBe(2);
    expect(readDeclaredVersion({ version: 0 })).toBe(0);
  });

  it("treats a non-numeric version as undeclared (0)", () => {
    expect(readDeclaredVersion({ version: "1" })).toBe(0);
    expect(readDeclaredVersion({ version: null })).toBe(0);
    expect(readDeclaredVersion({})).toBe(0);
  });

  it("treats a non-finite version (NaN/Infinity) as undeclared (0)", () => {
    expect(readDeclaredVersion({ version: Number.NaN })).toBe(0);
    expect(readDeclaredVersion({ version: Number.POSITIVE_INFINITY })).toBe(0);
  });

  it("returns 0 for a non-object or null blob", () => {
    expect(readDeclaredVersion(undefined)).toBe(0);
    expect(readDeclaredVersion(null)).toBe(0);
    expect(readDeclaredVersion("nope")).toBe(0);
    expect(readDeclaredVersion(7)).toBe(0);
  });
});

describe("applyPlayDataMigrations", () => {
  const steps: readonly PlayDataMigration[] = [
    { to: 1, migrate: (d) => ({ ...d, v1: true }) },
    { to: 2, migrate: (d) => ({ ...d, v2: true }) },
  ];

  it("applies only the steps newer than the declared version in ascending order of to", () => {
    expect(applyPlayDataMigrations({ base: true }, 0, steps)).toEqual({
      base: true,
      v1: true,
      v2: true,
    });
  });

  it("skips the step that migrates to the declared version", () => {
    expect(applyPlayDataMigrations({ base: true }, 1, steps)).toEqual({ base: true, v2: true });
  });

  it("applies no step when the declared version is newer than every step", () => {
    expect(applyPlayDataMigrations({ base: true }, 2, steps)).toEqual({ base: true });
  });

  it("returns the input itself when there are no steps", () => {
    const input = { version: 1 };

    expect(applyPlayDataMigrations(input, 0, [])).toBe(input);
  });

  it("passes a non-object or null blob through without applying any step", () => {
    expect(applyPlayDataMigrations("garbage", 0, steps)).toBe("garbage");
    expect(applyPlayDataMigrations(undefined, 0, steps)).toBe(undefined);
    expect(applyPlayDataMigrations(null, 0, steps)).toBe(null);
  });
});

describe("migratePlayData", () => {
  it("returns an empty current PlayData for an undefined or broken blob without throwing", () => {
    const empty = {
      version: CURRENT_PLAY_DATA_VERSION,
      field: { zone: "middle", losYard: 50 },
      players: [],
      lines: [],
    };

    expect(migratePlayData(undefined)).toEqual(empty);
    expect(migratePlayData("garbage")).toEqual(empty);
    expect(migratePlayData(42)).toEqual(empty);
    expect(migratePlayData(null)).toEqual(empty);
  });

  it("returns a new object with the same structure for a valid current PlayData", () => {
    const input: PlayData = {
      version: 2,
      field: { zone: "redzone", losYard: 85 },
      players: [
        {
          id: "qb",
          position: { lateralYard: 26, downfieldYard: 48 },
          shape: "circle",
          label: "QB",
        },
      ],
      lines: [
        {
          id: "r1",
          kind: "route",
          startPlayerId: "qb",
          waypoints: [],
          end: { lateralYard: 30, downfieldYard: 56 },
          interpolation: "straight",
        },
      ],
    };

    const migrated = migratePlayData(input);

    expect(migrated).toEqual(input);
    expect(migrated).not.toBe(input);
    expect(migrated.players[0]).not.toBe(input.players[0]);
    expect(migrated.lines[0]).not.toBe(input.lines[0]);
  });

  it("raises an unversioned legacy blob to the current version with LOS-relative yards", () => {
    // Unversioned data from the first release, with no version field.
    const legacy = {
      field: { zone: "own-redzone" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square" }],
    } as unknown;

    const migrated = migratePlayData(legacy);

    expect(migrated.version).toBe(CURRENT_PLAY_DATA_VERSION);
    expect(migrated.field).toEqual({ zone: "own-redzone", losYard: 10 });
    expect(migrated.players).toEqual([
      { id: "wr", position: { lateralYard: 5, downfieldYard: 40 }, shape: "square", label: "" },
    ]);
    expect(migrated.lines).toEqual([]);
  });

  it("coerces a future version blob to the current one and drops unknown fields", () => {
    const future = {
      version: 99,
      field: { zone: "middle" },
      players: [{ id: "qb", position: { lateralYard: 26, downfieldYard: 48 }, shape: "circle" }],
      lines: [],
      futureOnlyField: { whatever: true },
    } as unknown;

    const migrated = migratePlayData(future);

    expect(migrated.version).toBe(CURRENT_PLAY_DATA_VERSION);
    expect(migrated).not.toHaveProperty("futureOnlyField");
    expect(migrated.players.map((p) => p.id)).toEqual(["qb"]);
  });

  it("loads a blob with duplicate ids by making the player and line ids unique", () => {
    const duplicated = {
      version: 2,
      field: { zone: "middle" },
      players: [
        { id: "x", position: { lateralYard: 7, downfieldYard: 49 } },
        { id: "x", position: { lateralYard: 9, downfieldYard: 49 } },
      ],
      lines: [
        { id: "rt", startPlayerId: "x", end: { lateralYard: 7, downfieldYard: 55 } },
        { id: "rt", startPlayerId: "x", end: { lateralYard: 9, downfieldYard: 55 } },
      ],
    } as unknown;

    const migrated = migratePlayData(duplicated);

    expect(migrated.players.map((p) => p.id)).toEqual(["x", "x-2"]);
    expect(migrated.lines.map((l) => l.id)).toEqual(["rt", "rt-2"]);
  });

  it("returns the same value when getData output goes through JSON and migratePlayData", () => {
    const persisted: PlayData = {
      version: 2,
      field: { zone: "redzone", losYard: 85 },
      players: [
        { id: "x", position: { lateralYard: 7, downfieldYard: 49 }, shape: "circle", label: "X" },
      ],
      lines: [
        {
          id: "rt",
          kind: "route",
          startPlayerId: "x",
          waypoints: [{ lateralYard: 7, downfieldYard: 55 }],
          end: { lateralYard: 13, downfieldYard: 59 },
          interpolation: "bezier",
        },
      ],
    };

    const roundTripped = migratePlayData(JSON.parse(JSON.stringify(persisted)));

    expect(roundTripped).toEqual(persisted);
  });
});
