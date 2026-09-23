import { describe, expect, it, vi } from "vitest";
import { player } from "../../test-support/fixtures.js";
import type { EditorViewState } from "./editor.js";
import { EditorNotifier, isSameSelection, type ViewSnapshot } from "./editor-notifier.js";

const baseState: EditorViewState = {
  tool: "select",
  selection: null,
  canUndo: false,
  canRedo: false,
  fieldZone: "middle",
  isDrawing: false,
};

function setup(initial: ViewSnapshot = { state: baseState, player: undefined, line: undefined }) {
  let view = initial;
  const notifier = new EditorNotifier(() => view);
  const changes = vi.fn<(event: "scene" | "view") => void>();
  notifier.onDidChangeScene(() => changes("scene"));
  notifier.onDidChangeViewState(() => changes("view"));
  const setView = (next: ViewSnapshot): void => {
    view = next;
  };
  return { notifier, changes, setView };
}

describe("EditorNotifier", () => {
  it("batch の外で描く図が変わると、描く図の通知をすぐ出す", () => {
    const { notifier, changes } = setup();

    notifier.markChanged(true);

    expect(changes.mock.calls).toEqual([["scene"]]);
  });

  it("batch の中の変化は、入れ子になっていても外側の終わりに 1 回ずつまとめる", () => {
    const { notifier, changes, setView } = setup();

    notifier.batch(() => {
      notifier.markChanged(true);
      notifier.batch(() => notifier.markChanged(true));
      setView({ state: { ...baseState, canUndo: true }, player: undefined, line: undefined });
      notifier.markChanged(false);
      expect(changes).not.toHaveBeenCalled();
    });

    expect(changes.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("表示状態が前回の通知と同じなら、表示状態の通知は出さない", () => {
    const { notifier, changes, setView } = setup();
    setView({ state: { ...baseState }, player: undefined, line: undefined });

    notifier.markChanged(false);

    expect(changes).not.toHaveBeenCalled();
  });

  it("表示状態が同じでも、選択中の選手が別の値に差し替わっていれば通知する", () => {
    const before = player("a");
    const { notifier, changes, setView } = setup({
      state: baseState,
      player: before,
      line: undefined,
    });
    setView({ state: baseState, player: { ...before, label: "QB" }, line: undefined });

    notifier.markChanged(false);

    expect(changes.mock.calls).toEqual([["view"]]);
  });

  it("batch の中で例外が出ても、あとの batch は通知できる", () => {
    const { notifier, changes } = setup();

    expect(() =>
      notifier.batch(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    notifier.batch(() => notifier.markChanged(true));

    expect(changes.mock.calls).toEqual([["scene"]]);
  });
});

describe("isSameSelection", () => {
  it("種類と id が同じなら同じ選択とみなす", () => {
    expect(isSameSelection({ kind: "player", id: "a" }, { kind: "player", id: "a" })).toBe(true);
    expect(isSameSelection({ kind: "player", id: "a" }, { kind: "line", id: "a" })).toBe(false);
    expect(isSameSelection(null, null)).toBe(true);
    expect(isSameSelection(null, { kind: "player", id: "a" })).toBe(false);
  });
});
