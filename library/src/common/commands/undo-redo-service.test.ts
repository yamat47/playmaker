import { describe, expect, it, vi } from "vitest";
import type { ICommand } from "./command.js";
import { UndoRedoService } from "./undo-redo-service.js";

function fakeCommand(label = "cmd"): ICommand {
  return { label, apply: vi.fn(), undo: vi.fn() };
}

describe("UndoRedoService", () => {
  it("初期状態は戻すことも、やり直すこともできない", () => {
    const history = new UndoRedoService();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.peekUndo()).toBeUndefined();
    expect(history.peekRedo()).toBeUndefined();
  });

  it("積んだコマンドが次に戻す対象になり、通知が出る", () => {
    const history = new UndoRedoService();
    const listener = vi.fn();
    history.onDidChange(listener);
    const c = fakeCommand();

    history.push(c);

    expect(history.peekUndo()).toBe(c);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("戻したコマンドはやり直す対象へ移り、やり直すと戻す対象へ帰る", () => {
    const history = new UndoRedoService();
    const c = fakeCommand();
    history.push(c);

    history.markUndone();
    expect(history.peekRedo()).toBe(c);
    expect(history.canUndo).toBe(false);

    history.markRedone();
    expect(history.peekUndo()).toBe(c);
    expect(history.canRedo).toBe(false);
  });

  it("新しいコマンドを積むと、やり直しの履歴を捨てる", () => {
    const history = new UndoRedoService();
    history.push(fakeCommand("c1"));
    history.markUndone();

    history.push(fakeCommand("c2"));

    expect(history.canRedo).toBe(false);
  });

  it("空の履歴で戻しても、やり直しても何も起きず通知も出ない", () => {
    const history = new UndoRedoService();
    const listener = vi.fn();
    history.onDidChange(listener);

    history.markUndone();
    history.markRedone();

    expect(listener).not.toHaveBeenCalled();
  });

  it("コマンドそのものには触れない", () => {
    const history = new UndoRedoService();
    const c = fakeCommand();

    history.push(c);
    history.markUndone();
    history.markRedone();

    expect(c.apply).not.toHaveBeenCalled();
    expect(c.undo).not.toHaveBeenCalled();
  });
});
