import { describe, expect, it } from "vitest";
import { player } from "../../test-support/fixtures.js";
import {
  cloneLine,
  DEFAULT_LINE_INTERPOLATION,
  DEFAULT_LINE_KIND,
  indexPlayersById,
  isLineInterpolation,
  isLineKind,
  type Line,
  lineAnchorPoints,
  MAX_LINES,
  MAX_WAYPOINTS_PER_LINE,
  normalizeLines,
} from "./line.js";

const PLAYER_IDS = new Set(["qb", "wr"]);

describe("isLineKind", () => {
  it("3 種の正規種別を true と判定する", () => {
    expect(isLineKind("route")).toBe(true);
    expect(isLineKind("block")).toBe(true);
    expect(isLineKind("motion")).toBe(true);
  });

  it("未知の文字列や非文字列を false と判定する", () => {
    expect(isLineKind("curve")).toBe(false);
    expect(isLineKind("")).toBe(false);
    expect(isLineKind(undefined)).toBe(false);
    expect(isLineKind(0)).toBe(false);
  });
});

describe("isLineInterpolation", () => {
  it("straight / bezier を true、それ以外を false と判定する", () => {
    expect(isLineInterpolation("straight")).toBe(true);
    expect(isLineInterpolation("bezier")).toBe(true);
    expect(isLineInterpolation("spline")).toBe(false);
    expect(isLineInterpolation(undefined)).toBe(false);
  });
});

describe("normalizeLines", () => {
  it("正当な線はそのまま保持しつつ欠落を既定で補完する", () => {
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
        // kind/interpolation/id 欠落 → 既定補完。
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

  it("color は非空文字列、thickness は正の数のときだけ保持する", () => {
    const [a, b] = normalizeLines(
      [
        {
          startPlayerId: "qb",
          end: { lateralYard: 1, downfieldYard: 2 },
          color: "#ff0000",
          thickness: 4,
        },
        {
          startPlayerId: "qb",
          end: { lateralYard: 1, downfieldYard: 2 },
          color: "  ",
          thickness: -1,
        },
      ],
      PLAYER_IDS,
    );

    expect(a?.color).toBe("#ff0000");
    expect(a?.thickness).toBe(4);
    expect(b && "color" in b).toBe(false);
    expect(b && "thickness" in b).toBe(false);
  });

  it("起点選手が実在しない線は復元不能として捨てる（dangling 参照）", () => {
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

  it("終点が無い/数値でない/非オブジェクトの線は捨てる（復元不能）", () => {
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

  it("waypoint は数値でない要素だけ捨て、線自体は保持する", () => {
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

  it("waypoints が配列でなければ空配列にする", () => {
    const [line] = normalizeLines(
      [{ startPlayerId: "qb", waypoints: "nope", end: { lateralYard: 0, downfieldYard: 0 } }],
      PLAYER_IDS,
    );

    expect(line?.waypoints).toEqual([]);
  });

  it("id が無い/空なら index 由来の決定的 id を割り当てる", () => {
    const result = normalizeLines(
      [
        { startPlayerId: "qb", end: { lateralYard: 0, downfieldYard: 0 } },
        { id: "  ", startPlayerId: "qb", end: { lateralYard: 0, downfieldYard: 0 } },
      ],
      PLAYER_IDS,
    );

    expect(result.map((l) => l.id)).toEqual(["l0", "l1"]);
  });

  it("配列でない入力は空配列を返す", () => {
    expect(normalizeLines(undefined, PLAYER_IDS)).toEqual([]);
    expect(normalizeLines(null, PLAYER_IDS)).toEqual([]);
    expect(normalizeLines({ length: 1 }, PLAYER_IDS)).toEqual([]);
  });

  it("入力配列・要素・位置を共有しない新規オブジェクトを返す（Model 専有）", () => {
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

describe("normalizeLines の件数上限", () => {
  const end = { lateralYard: 5, downfieldYard: 60 };

  it("MAX_LINES 本を超える線は先頭の MAX_LINES 本だけ残す", () => {
    const raw = Array.from({ length: MAX_LINES + 5 }, (_, i) => ({
      id: `l${i}`,
      startPlayerId: "qb",
      end,
    }));

    const lines = normalizeLines(raw, PLAYER_IDS);

    expect(lines).toHaveLength(MAX_LINES);
    expect(lines.at(-1)?.id).toBe(`l${MAX_LINES - 1}`);
  });

  it("MAX_WAYPOINTS_PER_LINE 個を超える waypoint は先頭から上限の個数だけ残す", () => {
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
  it("waypoints・終点まで複製し元と共有しない", () => {
    const original: Line = {
      id: "x",
      kind: "motion",
      startPlayerId: "qb",
      waypoints: [{ lateralYard: 1, downfieldYard: 2 }],
      end: { lateralYard: 3, downfieldYard: 4 },
      interpolation: "bezier",
      color: "#00f",
      thickness: 3,
    };

    const copy = cloneLine(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.waypoints).not.toBe(original.waypoints);
    expect(copy.waypoints[0]).not.toBe(original.waypoints[0]);
    expect(copy.end).not.toBe(original.end);
  });

  it("color/thickness 未指定なら複製にも持たせない", () => {
    const copy = cloneLine({
      id: "x",
      kind: "route",
      startPlayerId: "qb",
      waypoints: [],
      end: { lateralYard: 0, downfieldYard: 0 },
      interpolation: "straight",
    });

    expect("color" in copy).toBe(false);
    expect("thickness" in copy).toBe(false);
  });
});

describe("lineAnchorPoints", () => {
  const players = [player("qb", 26, 48), player("wr", 5, 50)];
  const byId = indexPlayersById(players);

  it("[起点選手位置, ...waypoints, 終点] を順に組み立てる", () => {
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

  it("起点選手が見つからなければ undefined", () => {
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

  it("選手位置・waypoint を共有しない（後段の変形が Model を汚さない）", () => {
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
  it("id 引きの Map を作る", () => {
    const a = player("a", 0, 0);
    const b = player("b", 1, 1);

    const map = indexPlayersById([a, b]);

    expect(map.get("a")).toBe(a);
    expect(map.get("b")).toBe(b);
    expect(map.get("c")).toBeUndefined();
  });

  it("同 id は後勝ち（描画順 = 配列順の整合）", () => {
    const first = player("dup", 0, 0);
    const second = player("dup", 9, 9);

    expect(indexPlayersById([first, second]).get("dup")).toBe(second);
  });
});
