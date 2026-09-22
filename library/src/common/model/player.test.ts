import { describe, expect, it } from "vitest";
import {
  clonePlayer,
  DEFAULT_PLAYER_SHAPE,
  isPlayerShape,
  MAX_PLAYERS,
  normalizePlayers,
  PLAYER_RADIUS_YARDS,
  type Player,
  parseFieldPosition,
} from "./player.js";

describe("isPlayerShape", () => {
  it("6 種の正規形状を true と判定する", () => {
    for (const shape of ["circle", "square", "triangle", "diamond", "pentagon", "hexagon"]) {
      expect(isPlayerShape(shape)).toBe(true);
    }
  });

  it("未知の文字列や非文字列を false と判定する", () => {
    expect(isPlayerShape("star")).toBe(false);
    expect(isPlayerShape("")).toBe(false);
    expect(isPlayerShape(undefined)).toBe(false);
    expect(isPlayerShape(0)).toBe(false);
    expect(isPlayerShape({ shape: "circle" })).toBe(false);
  });
});

describe("PLAYER_RADIUS_YARDS", () => {
  it("正の半径である（描画と hit-test の共有定数）", () => {
    expect(PLAYER_RADIUS_YARDS).toBeGreaterThan(0);
  });
});

describe("normalizePlayers", () => {
  it("正当な選手はそのまま保持しつつ欠落を既定で補完する", () => {
    const result = normalizePlayers([
      { id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "square", label: "QB" },
      { id: "wr", position: { lateralYard: 5, absoluteYard: 50 } },
    ]);

    expect(result).toEqual([
      { id: "qb", position: { lateralYard: 26, absoluteYard: 48 }, shape: "square", label: "QB" },
      {
        id: "wr",
        position: { lateralYard: 5, absoluteYard: 50 },
        shape: DEFAULT_PLAYER_SHAPE,
        label: "",
      },
    ]);
  });

  it("color は非空文字列のときだけ保持する", () => {
    const [withColor, blankColor] = normalizePlayers([
      { id: "a", position: { lateralYard: 1, absoluteYard: 2 }, color: "#ff0000" },
      { id: "b", position: { lateralYard: 1, absoluteYard: 2 }, color: "   " },
    ]);

    expect(withColor?.color).toBe("#ff0000");
    expect(blankColor && "color" in blankColor).toBe(false);
  });

  it("配列でない入力は空配列を返す", () => {
    expect(normalizePlayers(undefined)).toEqual([]);
    expect(normalizePlayers(null)).toEqual([]);
    expect(normalizePlayers({ length: 1 })).toEqual([]);
  });

  it("位置が無い/数値でない/非オブジェクトの要素は捨てる（復元不能）", () => {
    const result = normalizePlayers([
      null,
      "player",
      { id: "no-pos" },
      { id: "nan", position: { lateralYard: Number.NaN, absoluteYard: 0 } },
      { id: "infinite", position: { lateralYard: 0, absoluteYard: Number.POSITIVE_INFINITY } },
      { id: "str", position: { lateralYard: "1", absoluteYard: 2 } },
      { id: "ok", position: { lateralYard: 1, absoluteYard: 2 } },
    ]);

    expect(result.map((p) => p.id)).toEqual(["ok"]);
  });

  it("id が無い/空なら index 由来の決定的 id を割り当てる", () => {
    const result = normalizePlayers([
      { position: { lateralYard: 0, absoluteYard: 0 } },
      { id: "  ", position: { lateralYard: 0, absoluteYard: 0 } },
    ]);

    expect(result.map((p) => p.id)).toEqual(["p0", "p1"]);
  });

  it("入力配列・要素・位置を共有しない新規オブジェクトを返す（Model 専有）", () => {
    const input = [{ id: "a", position: { lateralYard: 1, absoluteYard: 2 } }];

    const [normalized] = normalizePlayers(input);

    expect(normalized).not.toBe(input[0]);
    expect(normalized?.position).not.toBe(input[0]?.position);
  });
});

describe("normalizePlayers の件数上限", () => {
  const at = (i: number) => ({ id: `p${i}`, position: { lateralYard: 5, absoluteYard: i } });

  it("MAX_PLAYERS 人を超える選手は先頭の MAX_PLAYERS 人だけ残す", () => {
    const raw = Array.from({ length: MAX_PLAYERS + 5 }, (_, i) => at(i));

    const players = normalizePlayers(raw);

    expect(players).toHaveLength(MAX_PLAYERS);
    expect(players.at(-1)?.id).toBe(`p${MAX_PLAYERS - 1}`);
  });

  it("先頭の MAX_PLAYERS 個に復元できない要素があれば、その分だけ少なくなる", () => {
    const raw = [null, ...Array.from({ length: MAX_PLAYERS }, (_, i) => at(i))];

    expect(normalizePlayers(raw)).toHaveLength(MAX_PLAYERS - 1);
  });
});

describe("parseFieldPosition", () => {
  it("有限な座標を持つオブジェクトを新しい位置として返す", () => {
    const raw = { lateralYard: 5, absoluteYard: 50, extra: true };

    const position = parseFieldPosition(raw);

    expect(position).toEqual({ lateralYard: 5, absoluteYard: 50 });
    expect(position).not.toBe(raw);
  });

  it("座標が欠けているか数でなければ null を返す", () => {
    expect(parseFieldPosition({ lateralYard: 5 })).toBeNull();
    expect(parseFieldPosition({ lateralYard: "5", absoluteYard: 50 })).toBeNull();
    expect(parseFieldPosition({ lateralYard: 5, absoluteYard: Number.NaN })).toBeNull();
  });

  it("オブジェクトでなければ null を返す", () => {
    expect(parseFieldPosition(null)).toBeNull();
    expect(parseFieldPosition("5,50")).toBeNull();
  });
});

describe("clonePlayer", () => {
  it("位置まで複製し元と共有しない", () => {
    const original: Player = {
      id: "x",
      position: { lateralYard: 3, absoluteYard: 4 },
      shape: "diamond",
      label: "X",
      color: "#00f",
    };

    const copy = clonePlayer(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.position).not.toBe(original.position);
  });

  it("color 未指定なら複製にも color を持たせない", () => {
    const copy = clonePlayer({
      id: "x",
      position: { lateralYard: 0, absoluteYard: 0 },
      shape: "circle",
      label: "",
    });

    expect("color" in copy).toBe(false);
  });
});
