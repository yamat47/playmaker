import { describe, expect, it } from "vitest";
import {
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
