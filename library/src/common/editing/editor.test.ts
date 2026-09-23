import { describe, expect, it } from "vitest";
import type { Formation } from "../formations/formation.js";
import { canLoadFormation, type EditorViewState, isToolAvailable } from "./editor.js";

const state: EditorViewState = {
  tool: "select",
  selection: null,
  canUndo: false,
  canRedo: false,
  fieldZone: "middle",
  isDrawing: false,
  remainingPlayerSlots: 2,
  canStartLine: true,
};

function formationOf(count: number): Formation {
  return {
    id: "f",
    name: "f",
    side: "offense",
    players: Array.from({ length: count }, (_, i) => ({
      position: { lateralYard: 10 + i, downfieldYard: -5 },
      shape: "circle",
      label: "",
    })),
  };
}

describe("isToolAvailable", () => {
  it("上限に達していなければ、どのツールも使える", () => {
    expect(isToolAvailable("select", state)).toBe(true);
    expect(isToolAvailable("add-player", state)).toBe(true);
    expect(isToolAvailable("draw-line", state)).toBe(true);
  });

  it("置ける選手が 0 人なら、選手の追加ツールは使えない", () => {
    expect(isToolAvailable("add-player", { ...state, remainingPlayerSlots: 0 })).toBe(false);
  });

  it("線を描き始められないなら、作図ツールは使えない", () => {
    expect(isToolAvailable("draw-line", { ...state, canStartLine: false })).toBe(false);
  });

  it("上限に達していても、選択ツールは使える", () => {
    const full = { ...state, remainingPlayerSlots: 0, canStartLine: false };

    expect(isToolAvailable("select", full)).toBe(true);
  });
});

describe("canLoadFormation", () => {
  it("人数がちょうど置ける人数までなら読み込める", () => {
    expect(canLoadFormation(formationOf(2), state)).toBe(true);
  });

  it("置ける人数より多いフォーメーションは読み込めない", () => {
    expect(canLoadFormation(formationOf(3), state)).toBe(false);
  });
});
