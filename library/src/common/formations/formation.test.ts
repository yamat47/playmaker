import { describe, expect, it } from "vitest";
import { must } from "../../test-support/must.js";
import type { IIdFactory } from "../model/id-factory.js";
import { type Formation, instantiateFormation, normalizeFormation } from "./formation.js";

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
        // id は空白、name は無し、side は無い値なので、どれも既定になる。
        id: "   ",
        side: "kickoff",
        players: [{ id: "should-be-dropped", position: { lateralYard: 5, downfieldYard: 50 } }],
      }),
    );

    expect(result.id).toBe("formation");
    expect(result.name).toBe("フォーメーション");
    expect(result.side).toBe("offense");
    // FormationPlayer は id を持たない（shape/label は normalizePlayers が既定補完）。
    expect(result.players).toEqual([
      { position: { lateralYard: 5, downfieldYard: 50 }, shape: "circle", label: "" },
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
          { position: { lateralYard: 7, downfieldYard: 53 }, shape: "square", color: "#c62828" },
          { position: { lateralYard: 46, downfieldYard: 53 }, shape: "square" },
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
      players: [{ position: { lateralYard: 1, downfieldYard: 2 } }],
    };
    const result = must(normalizeFormation(input));

    must(input.players[0]).position.lateralYard = 999;

    expect(must(result.players[0]).position.lateralYard).toBe(1);
  });
});

describe("instantiateFormation", () => {
  const formation: Formation = {
    id: "pair",
    name: "2 人",
    side: "offense",
    players: [
      { position: { lateralYard: 1, downfieldYard: 0 }, shape: "circle", label: "A" },
      { position: { lateralYard: 2, downfieldYard: 0 }, shape: "square", label: "B" },
    ],
  };

  it("テンプレートの順に id を振った選手を返す", () => {
    let n = 0;
    const ids: IIdFactory = { next: () => `id-${++n}` };

    expect(instantiateFormation(formation, ids, [])).toEqual([
      { ...formation.players[0], id: "id-1" },
      { ...formation.players[1], id: "id-2" },
    ]);
  });

  it("既にある id と、先に振った id の両方を採番で避ける", () => {
    const seen: string[][] = [];
    const ids: IIdFactory = {
      next: (_, taken) => {
        seen.push([...taken].sort());
        return `id-${seen.length}`;
      },
    };

    instantiateFormation(formation, ids, ["x"]);

    expect(seen).toEqual([["x"], ["id-1", "x"]]);
  });
});
