import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import {
  clonePlayData,
  createEmptyPlayData,
  DEFAULT_FIELD_ZONE,
  isFieldZone,
  type PlayData,
  resolvePlayData,
} from "./play-data.js";

describe("createEmptyPlayData", () => {
  it("version 1・既定ゾーン・選手/線なしの新規データを返す", () => {
    const data = createEmptyPlayData();

    expect(data).toEqual({
      version: 1,
      field: { zone: DEFAULT_FIELD_ZONE },
      players: [],
      lines: [],
    });
  });

  it("呼ぶたびに独立したオブジェクトを返す（共有しない）", () => {
    const a = createEmptyPlayData();
    const b = createEmptyPlayData();

    expect(a).not.toBe(b);
    expect(a.field).not.toBe(b.field);
    expect(a.players).not.toBe(b.players);
    expect(a.lines).not.toBe(b.lines);
  });
});

describe("clonePlayData", () => {
  const source: PlayData = {
    version: 1,
    field: { zone: "redzone" },
    players: [
      {
        id: "qb",
        position: { lateralYard: 26, absoluteYard: 48 },
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
        waypoints: [{ lateralYard: 30, absoluteYard: 52 }],
        end: { lateralYard: 35, absoluteYard: 60 },
        interpolation: "bezier",
      },
    ],
  };

  it("値が等しく独立した深いコピーを返す", () => {
    const copy = clonePlayData(source);

    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy.field).not.toBe(source.field);
    expect(copy.players[0]).not.toBe(source.players[0]);
    expect(copy.lines[0]).not.toBe(source.lines[0]);
    expect(copy.lines[0]?.waypoints[0]).not.toBe(source.lines[0]?.waypoints[0]);
  });

  it("コピーを書き換えても元データへ波及しない", () => {
    const copy = mutable(clonePlayData(source));

    copy.field.zone = "middle";
    must(copy.players[0]).label = "WR";
    must(copy.lines[0]).waypoints.push({ lateralYard: 0, absoluteYard: 0 });

    expect(source.field.zone).toBe("redzone");
    expect(source.players[0]?.label).toBe("QB");
    expect(source.lines[0]?.waypoints).toHaveLength(1);
  });
});

describe("isFieldZone", () => {
  it("3 つの正規ゾーンを true と判定する", () => {
    expect(isFieldZone("middle")).toBe(true);
    expect(isFieldZone("redzone")).toBe(true);
    expect(isFieldZone("own-redzone")).toBe(true);
  });

  it("未知の文字列や非文字列を false と判定する", () => {
    expect(isFieldZone("center")).toBe(false);
    expect(isFieldZone("")).toBe(false);
    expect(isFieldZone(undefined)).toBe(false);
    expect(isFieldZone(0)).toBe(false);
    expect(isFieldZone({ zone: "middle" })).toBe(false);
  });
});

describe("resolvePlayData", () => {
  it("undefined には既定ゾーン・選手/線なしの空データを返す", () => {
    expect(resolvePlayData(undefined)).toEqual({
      version: 1,
      field: { zone: DEFAULT_FIELD_ZONE },
      players: [],
      lines: [],
    });
  });

  it("正当なゾーンはそのまま保持する", () => {
    const input: PlayData = { version: 1, field: { zone: "redzone" }, players: [], lines: [] };

    expect(resolvePlayData(input).field.zone).toBe("redzone");
  });

  it("入力を共有せず新規オブジェクトを返す（Model 専有）", () => {
    const input: PlayData = { version: 1, field: { zone: "own-redzone" }, players: [], lines: [] };

    const resolved = resolvePlayData(input);

    expect(resolved).not.toBe(input);
    expect(resolved.field).not.toBe(input.field);
    expect(resolved.players).not.toBe(input.players);
    expect(resolved.lines).not.toBe(input.lines);
    expect(resolved.field.zone).toBe("own-redzone");
  });

  it("不正・欠落したゾーンは既定へフォールバックする（古い永続データ耐性）", () => {
    const broken = { version: 1, field: { zone: "bogus" } } as unknown as PlayData;
    const missingField = { version: 1 } as unknown as PlayData;

    expect(resolvePlayData(broken).field.zone).toBe(DEFAULT_FIELD_ZONE);
    expect(resolvePlayData(missingField).field.zone).toBe(DEFAULT_FIELD_ZONE);
  });

  it("選手を正規化して保持し、入力要素を共有しない", () => {
    const input = {
      version: 1,
      field: { zone: "middle" },
      players: [{ id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "square" }],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players).toEqual([
      {
        id: "qb",
        position: { lateralYard: 26, absoluteYard: 48 },
        shape: "square",
        label: "",
      },
    ]);
    expect(resolved.players[0]).not.toBe(input.players[0]);
  });

  it("players が無い/不正なら空配列にフォールバックする（古い永続データ耐性）", () => {
    const missing = { version: 1, field: { zone: "middle" } } as unknown as PlayData;
    const broken = {
      version: 1,
      field: { zone: "middle" },
      players: "nope",
    } as unknown as PlayData;

    expect(resolvePlayData(missing).players).toEqual([]);
    expect(resolvePlayData(broken).players).toEqual([]);
  });

  it("線を正規化し、確定済み選手を起点に持つものだけ残す", () => {
    const input = {
      version: 1,
      field: { zone: "middle" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 } }],
      lines: [
        {
          id: "r1",
          kind: "route",
          startPlayerId: "wr",
          end: { lateralYard: 5, absoluteYard: 60 },
        },
        // 起点が存在しない選手 → 復元不能として除外。
        {
          id: "r2",
          kind: "route",
          startPlayerId: "ghost",
          end: { lateralYard: 0, absoluteYard: 0 },
        },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.lines.map((l) => l.id)).toEqual(["r1"]);
    expect(resolved.lines[0]).not.toBe(input.lines[0]);
  });

  it("重複した選手 id は後ろの方を振り直し、その id を指す線は先頭の選手に付ける", () => {
    const input = {
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "wr", position: { lateralYard: 5, absoluteYard: 50 } },
        { id: "wr", position: { lateralYard: 9, absoluteYard: 50 } },
      ],
      lines: [{ id: "r1", startPlayerId: "wr", end: { lateralYard: 5, absoluteYard: 60 } }],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players.map((p) => [p.id, p.position.lateralYard])).toEqual([
      ["wr", 5],
      ["wr-2", 9],
    ]);
    expect(resolved.lines.map((l) => l.startPlayerId)).toEqual(["wr"]);
  });

  it("振り直す id は入力に明示された他の id と衝突させない", () => {
    const input = {
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "a", position: { lateralYard: 1, absoluteYard: 50 } },
        { id: "a", position: { lateralYard: 2, absoluteYard: 50 } },
        { id: "a-2", position: { lateralYard: 3, absoluteYard: 50 } },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players.map((p) => p.id)).toEqual(["a", "a-3", "a-2"]);
  });

  it("補完した id が明示 id と衝突したら、補完した側を振り直す", () => {
    // id の無い 2 番目（index 1）は p1 を補完されるが、先頭が明示的に p1 を持つ。
    const input = {
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "p1", position: { lateralYard: 1, absoluteYard: 50 } },
        { position: { lateralYard: 2, absoluteYard: 50 } },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.players.map((p) => p.id)).toEqual(["p1", "p1-2"]);
  });

  it("重複した線 id は後ろの方を振り直す", () => {
    const input = {
      version: 1,
      field: { zone: "middle" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 50 } }],
      lines: [
        { id: "r", startPlayerId: "wr", end: { lateralYard: 5, absoluteYard: 60 } },
        { id: "r", startPlayerId: "wr", end: { lateralYard: 9, absoluteYard: 60 } },
      ],
    } as unknown as PlayData;

    const resolved = resolvePlayData(input);

    expect(resolved.lines.map((l) => l.id)).toEqual(["r", "r-2"]);
  });

  it("lines が無い/不正なら空配列にフォールバックする（古い永続データ耐性）", () => {
    const missing = {
      version: 1,
      field: { zone: "middle" },
      players: [],
    } as unknown as PlayData;
    const broken = {
      version: 1,
      field: { zone: "middle" },
      players: [],
      lines: "nope",
    } as unknown as PlayData;

    expect(resolvePlayData(missing).lines).toEqual([]);
    expect(resolvePlayData(broken).lines).toEqual([]);
  });
});
