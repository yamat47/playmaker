import { describe, expect, it } from "vitest";
import {
  applyPlayDataMigrations,
  migratePlayData,
  type PlayDataMigration,
  readDeclaredVersion,
} from "./migration.js";
import { CURRENT_PLAY_DATA_VERSION, type PlayData } from "./play-data.js";

describe("readDeclaredVersion", () => {
  it("有限数の version をそのまま返す", () => {
    expect(readDeclaredVersion({ version: 1 })).toBe(1);
    expect(readDeclaredVersion({ version: 2 })).toBe(2);
    expect(readDeclaredVersion({ version: 0 })).toBe(0);
  });

  it("version が数値でなければ版の宣言なし(0)とみなす", () => {
    expect(readDeclaredVersion({ version: "1" })).toBe(0);
    expect(readDeclaredVersion({ version: null })).toBe(0);
    expect(readDeclaredVersion({})).toBe(0);
  });

  it("非有限数(NaN/Infinity)も版の宣言なし(0)とみなす", () => {
    expect(readDeclaredVersion({ version: Number.NaN })).toBe(0);
    expect(readDeclaredVersion({ version: Number.POSITIVE_INFINITY })).toBe(0);
  });

  it("オブジェクトでない/null の blob は 0 を返す", () => {
    expect(readDeclaredVersion(undefined)).toBe(0);
    expect(readDeclaredVersion(null)).toBe(0);
    expect(readDeclaredVersion("nope")).toBe(0);
    expect(readDeclaredVersion(7)).toBe(0);
  });
});

describe("applyPlayDataMigrations", () => {
  // 段注入で「適用/スキップ」両分岐を UI/レジストリ無しに検証する（VSCode 流フェイク注入）。
  const steps: readonly PlayDataMigration[] = [
    { to: 1, migrate: (d) => ({ ...d, v1: true }) },
    { to: 2, migrate: (d) => ({ ...d, v2: true }) },
  ];

  it("宣言版より新しい段だけを to 昇順に適用する", () => {
    expect(applyPlayDataMigrations({ base: true }, 0, steps)).toEqual({
      base: true,
      v1: true,
      v2: true,
    });
  });

  it("宣言版以下の段はスキップする（境界 to === declared も適用しない）", () => {
    // declared=1: to:1 はスキップ（false 分岐）、to:2 のみ適用。
    expect(applyPlayDataMigrations({ base: true }, 1, steps)).toEqual({ base: true, v2: true });
    // declared=2: 全段スキップ＝未来版の前方互換（素通し）。
    expect(applyPlayDataMigrations({ base: true }, 2, steps)).toEqual({ base: true });
  });

  it("段が空なら入力をそのまま返す（現行 lib の本番経路）", () => {
    const input = { version: 1 };

    expect(applyPlayDataMigrations(input, 0, [])).toBe(input);
  });

  it("オブジェクトでない/null の blob は段適用せず素通しする", () => {
    expect(applyPlayDataMigrations("garbage", 0, steps)).toBe("garbage");
    expect(applyPlayDataMigrations(undefined, 0, steps)).toBe(undefined);
    expect(applyPlayDataMigrations(null, 0, steps)).toBe(null);
  });
});

describe("migratePlayData", () => {
  it("undefined/破損 blob でも投げず空の現行 PlayData を返す", () => {
    const empty = {
      version: CURRENT_PLAY_DATA_VERSION,
      field: { zone: "middle" },
      players: [],
      lines: [],
    };

    expect(migratePlayData(undefined)).toEqual(empty);
    expect(migratePlayData("garbage")).toEqual(empty);
    expect(migratePlayData(42)).toEqual(empty);
    expect(migratePlayData(null)).toEqual(empty);
  });

  it("正当な現行 PlayData は構造を保ち入力と切り離した新規オブジェクトを返す", () => {
    const input: PlayData = {
      version: 1,
      field: { zone: "redzone" },
      players: [
        { id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "circle", label: "QB" },
      ],
      lines: [
        {
          id: "r1",
          kind: "route",
          startPlayerId: "qb",
          waypoints: [],
          end: { lateralYard: 30, absoluteYard: 56 },
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

  it("版なしの旧来 blob を現行版へ引き上げ、復元可能な構造は保持する", () => {
    // 商用ソフト初期の未バージョン化データ（version フィールドが無い）。
    const legacy = {
      field: { zone: "own-redzone" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square" }],
    } as unknown;

    const migrated = migratePlayData(legacy);

    expect(migrated.version).toBe(CURRENT_PLAY_DATA_VERSION);
    expect(migrated.field.zone).toBe("own-redzone");
    expect(migrated.players).toEqual([
      { id: "wr", position: { lateralYard: 5, absoluteYard: 50 }, shape: "square", label: "" },
    ]);
    expect(migrated.lines).toEqual([]);
  });

  it("未来版 blob は前方互換で現行へ寄せ、未知フィールドは落として投げない", () => {
    const future = {
      version: 99,
      field: { zone: "middle" },
      players: [{ id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "circle" }],
      lines: [],
      futureOnlyField: { whatever: true },
    } as unknown;

    const migrated = migratePlayData(future);

    expect(migrated.version).toBe(CURRENT_PLAY_DATA_VERSION);
    expect(migrated).not.toHaveProperty("futureOnlyField");
    expect(migrated.players.map((p) => p.id)).toEqual(["qb"]);
  });

  it("getData→JSON→migratePlayData の往復で同値に戻る（PRD 5.8 往復契約）", () => {
    const persisted: PlayData = {
      version: 1,
      field: { zone: "redzone" },
      players: [
        { id: "x", position: { lateralYard: 7, absoluteYard: 49 }, shape: "circle", label: "X" },
      ],
      lines: [
        {
          id: "rt",
          kind: "route",
          startPlayerId: "x",
          waypoints: [{ lateralYard: 7, absoluteYard: 55 }],
          end: { lateralYard: 13, absoluteYard: 59 },
          interpolation: "bezier",
        },
      ],
    };

    const roundTripped = migratePlayData(JSON.parse(JSON.stringify(persisted)));

    expect(roundTripped).toEqual(persisted);
  });
});
