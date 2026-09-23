import { describe, expect, it, vi } from "vitest";
import type { ICommand } from "./command.js";
import { UndoRedoService } from "./undo-redo-service.js";

function fakeCommand(label = "cmd"): ICommand {
  return { label, apply: vi.fn(), undo: vi.fn() };
}

describe("UndoRedoService", () => {
  it("何も積んでいなければ undo も redo もできない", () => {
    const history = new UndoRedoService();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it("push すると undo できるようになる", () => {
    const history = new UndoRedoService();

    history.push(fakeCommand());

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("undo は最後に積んだコマンドを渡し、redo の側へ移す", () => {
    const history = new UndoRedoService();
    const command = fakeCommand();
    history.push(command);
    const revert = vi.fn();

    history.undo(revert);

    expect(revert).toHaveBeenCalledExactlyOnceWith(command);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it("redo は最後に取り消したコマンドを渡し、undo の側へ戻す", () => {
    const history = new UndoRedoService();
    const command = fakeCommand();
    history.push(command);
    history.undo(vi.fn());
    const reapply = vi.fn();

    history.redo(reapply);

    expect(reapply).toHaveBeenCalledExactlyOnceWith(command);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("取り消したあとに push すると redo の履歴を捨てる", () => {
    const history = new UndoRedoService();
    history.push(fakeCommand("c1"));
    history.undo(vi.fn());

    history.push(fakeCommand("c2"));

    expect(history.canRedo).toBe(false);
  });

  it("積んだ順と逆の順に取り消す", () => {
    const history = new UndoRedoService();
    const first = fakeCommand("first");
    const second = fakeCommand("second");
    history.push(first);
    history.push(second);
    const revert = vi.fn();

    history.undo(revert);
    history.undo(revert);

    expect(revert.mock.calls).toEqual([[second], [first]]);
  });

  it("revert が throw したら、コマンドは undo の側に残る", () => {
    const history = new UndoRedoService();
    const command = fakeCommand();
    history.push(command);

    expect(() =>
      history.undo(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    const revert = vi.fn();
    history.undo(revert);
    expect(revert).toHaveBeenCalledExactlyOnceWith(command);
  });

  it("reapply が throw したら、コマンドは redo の側に残る", () => {
    const history = new UndoRedoService();
    history.push(fakeCommand());
    history.undo(vi.fn());

    expect(() =>
      history.redo(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it("空の側を undo や redo しても、渡した関数を呼ばず通知もしない", () => {
    const history = new UndoRedoService();
    const onDidChange = vi.fn();
    history.onDidChange(onDidChange);
    const run = vi.fn();

    history.undo(run);
    history.redo(run);

    expect(run).not.toHaveBeenCalled();
    expect(onDidChange).not.toHaveBeenCalled();
  });

  it("push、undo、redo のたびに 1 回ずつ通知する", () => {
    const history = new UndoRedoService();
    const onDidChange = vi.fn();
    history.onDidChange(onDidChange);

    history.push(fakeCommand());
    history.undo(vi.fn());
    history.redo(vi.fn());

    expect(onDidChange).toHaveBeenCalledTimes(3);
  });

  it("通知を受けた時点で、canUndo と canRedo は変わったあとの値になっている", () => {
    const history = new UndoRedoService();
    const seen: [boolean, boolean][] = [];
    history.onDidChange(() => seen.push([history.canUndo, history.canRedo]));

    history.push(fakeCommand());
    history.undo(vi.fn());

    expect(seen).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it("実行が throw したときは通知しない", () => {
    const history = new UndoRedoService();
    history.push(fakeCommand());
    const onDidChange = vi.fn();
    history.onDidChange(onDidChange);

    expect(() =>
      history.undo(() => {
        throw new Error("boom");
      }),
    ).toThrow();

    expect(onDidChange).not.toHaveBeenCalled();
  });
});
