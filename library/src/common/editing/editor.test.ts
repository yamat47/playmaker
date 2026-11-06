import { describe, expect, it } from "vitest";
import { type EditorViewState, isToolAvailable } from "./editor.js";

const state: EditorViewState = {
  tool: "select",
  selection: { kind: "none" },
  canUndo: false,
  canRedo: false,
  fieldZone: "middle",
  isDrawing: false,
  remainingPlayerSlots: 2,
  canStartLine: true,
};

describe("isToolAvailable", () => {
  it("every tool is available while no limit is reached", () => {
    expect(isToolAvailable("select", state)).toBe(true);
    expect(isToolAvailable("add-player", state)).toBe(true);
    expect(isToolAvailable("draw-line", state)).toBe(true);
  });

  it("the add-player tool is unavailable when no player slot remains", () => {
    expect(isToolAvailable("add-player", { ...state, remainingPlayerSlots: 0 })).toBe(false);
  });

  it("the draw-line tool is unavailable when a line cannot be started", () => {
    expect(isToolAvailable("draw-line", { ...state, canStartLine: false })).toBe(false);
  });

  it("the select tool stays available when every limit is reached", () => {
    const full = { ...state, remainingPlayerSlots: 0, canStartLine: false };

    expect(isToolAvailable("select", full)).toBe(true);
  });
});
