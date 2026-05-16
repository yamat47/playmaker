import { describe, expect, it, vi } from "vitest";
import type { ICommand } from "../commands/command.js";
import type { IPlayModel } from "../model/play-model.js";
import { UndoRedoService } from "./undo-redo-service.js";

// Model はコマンドへ素通しされるだけ＝当たり判定用のセンチネルで十分。
const model = { tag: "model" } as unknown as IPlayModel;

function fakeCommand(label = "cmd"): ICommand {
  return { label, apply: vi.fn(), undo: vi.fn() };
}

describe("UndoRedoService", () => {
  it("初期状態は undo も redo もできない", () => {
    const svc = new UndoRedoService(model);

    expect(svc.canUndo).toBe(false);
    expect(svc.canRedo).toBe(false);
  });

  it("push で undo 可能になり、redo 履歴は破棄される", () => {
    const svc = new UndoRedoService(model);
    const c1 = fakeCommand("c1");
    svc.push(c1);
    svc.undo(); // c1 を redo スタックへ
    expect(svc.canRedo).toBe(true);

    svc.push(fakeCommand("c2")); // 新規編集 → redo 破棄

    expect(svc.canUndo).toBe(true);
    expect(svc.canRedo).toBe(false);
  });

  it("undo は逆操作を Model へ走らせ redo へ移す", () => {
    const svc = new UndoRedoService(model);
    const c = fakeCommand();
    svc.push(c);

    svc.undo();

    expect(c.undo).toHaveBeenCalledExactlyOnceWith(model);
    expect(svc.canUndo).toBe(false);
    expect(svc.canRedo).toBe(true);
  });

  it("redo は再適用を Model へ走らせ undo へ戻す", () => {
    const svc = new UndoRedoService(model);
    const c = fakeCommand();
    svc.push(c);
    svc.undo();

    svc.redo();

    expect(c.apply).toHaveBeenCalledExactlyOnceWith(model);
    expect(svc.canUndo).toBe(true);
    expect(svc.canRedo).toBe(false);
  });

  it("空スタックでの undo / redo は何もしない", () => {
    const svc = new UndoRedoService(model);

    expect(() => {
      svc.undo();
      svc.redo();
    }).not.toThrow();
    expect(svc.canUndo).toBe(false);
    expect(svc.canRedo).toBe(false);
  });

  it("clear で両スタックを破棄する", () => {
    const svc = new UndoRedoService(model);
    svc.push(fakeCommand());
    svc.undo();
    expect(svc.canRedo).toBe(true);

    svc.clear();

    expect(svc.canUndo).toBe(false);
    expect(svc.canRedo).toBe(false);
  });

  it("LIFO で複数コマンドを巻き戻す", () => {
    const svc = new UndoRedoService(model);
    const order: string[] = [];
    const make = (id: string): ICommand => ({
      label: id,
      apply: vi.fn(),
      undo: vi.fn(() => order.push(id)),
    });
    svc.push(make("first"));
    svc.push(make("second"));

    svc.undo();
    svc.undo();

    expect(order).toEqual(["second", "first"]);
  });
});
