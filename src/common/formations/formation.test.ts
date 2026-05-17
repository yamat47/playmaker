import { describe, expect, it } from "vitest";
import type { Player } from "../model/player.js";
import { type Formation, isFormationSide, normalizeFormation } from "./formation.js";

// noUncheckedIndexedAccess / null 返しを `!` 無しで絞るためのテスト局所ヘルパ。
function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}

describe("isFormationSide", () => {
  it("offense / defense のみ真、それ以外は偽", () => {
    expect(isFormationSide("offense")).toBe(true);
    expect(isFormationSide("defense")).toBe(true);
    expect(isFormationSide("special")).toBe(false);
    expect(isFormationSide(0)).toBe(false);
    expect(isFormationSide(undefined)).toBe(false);
  });
});

describe("normalizeFormation: 復元不能", () => {
  it("オブジェクトでない / null は null", () => {
    expect(normalizeFormation("formation")).toBeNull();
    expect(normalizeFormation(42)).toBeNull();
    expect(normalizeFormation(null)).toBeNull();
  });

  it("配置可能な選手が 0 人なら null（players 非配列・全要素不正の両方）", () => {
    expect(normalizeFormation({ id: "x", name: "X", side: "offense" })).toBeNull();
    expect(normalizeFormation({ players: "nope" })).toBeNull();
    expect(normalizeFormation({ players: [{ shape: "circle" }] })).toBeNull(); // position 欠落で除外
  });
});

describe("normalizeFormation: 既定補完", () => {
  it("id/name/side 欠落・空白は既定へ、選手は id を落として取り込む", () => {
    const result = must(
      normalizeFormation({
        // id 空白 → 既定 "formation"、name 欠落 → 既定、side 不正 → "offense"
        id: "   ",
        side: "kickoff",
        players: [{ id: "should-be-dropped", position: { lateralYard: 5, absoluteYard: 50 } }],
      }),
    );

    expect(result.id).toBe("formation");
    expect(result.name).toBe("フォーメーション");
    expect(result.side).toBe("offense");
    // FormationPlayer は id を持たない（shape/label は normalizePlayers が既定補完）。
    expect(result.players).toEqual([
      { position: { lateralYard: 5, absoluteYard: 50 }, shape: "circle", label: "" },
    ]);
    expect("id" in must(result.players[0])).toBe(false);
  });

  it("id/name/side 指定時はその値を使い、色はある時だけ持たせる", () => {
    const result = must(
      normalizeFormation({
        id: "nickel",
        name: "ニッケル",
        side: "defense",
        players: [
          { position: { lateralYard: 7, absoluteYard: 53 }, shape: "hexagon", color: "#c62828" },
          { position: { lateralYard: 46, absoluteYard: 53 }, shape: "hexagon" },
        ],
      }),
    );

    expect(result.id).toBe("nickel");
    expect(result.name).toBe("ニッケル");
    expect(result.side).toBe("defense");
    expect(must(result.players[0]).color).toBe("#c62828");
    expect("color" in must(result.players[1])).toBe(false);
  });

  it("返り値は入力と切り離されている（位置を書き換えても波及しない）", () => {
    const input = {
      players: [{ position: { lateralYard: 1, absoluteYard: 2 } }],
    };
    const result = must(normalizeFormation(input));

    must(input.players[0]).position.lateralYard = 999;

    expect(must(result.players[0]).position.lateralYard).toBe(1);
  });
});

describe("Formation 型は typed なテンプレートとして組み立てられる", () => {
  it("プリセット相当の typed Formation を直接構築できる", () => {
    const offense: Formation = {
      id: "i-form",
      name: "I フォーメーション",
      side: "offense",
      players: [
        { position: { lateralYard: 26.7, absoluteYard: 49.5 }, shape: "square", label: "C" },
      ],
    };
    const players: readonly Omit<Player, "id">[] = offense.players;

    expect(players).toHaveLength(1);
  });
});
