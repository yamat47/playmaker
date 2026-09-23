import { describe, expect, it, vi } from "vitest";
import type { IPlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";
import { CommandService } from "./command-service.js";
import { UndoRedoService } from "./undo-redo-service.js";

// Model はコマンドへ素通しされるだけなので、渡ったことを確かめる目印で足りる。
const model = { tag: "model" } as unknown as IPlayModel;

function fakeCommand(): ICommand {
  return { label: "cmd", apply: vi.fn(), undo: vi.fn() };
}

function throwing(): never {
  throw new Error("boom");
}

function setup() {
  const history = new UndoRedoService();
  return { history, service: new CommandService(model, history) };
}

describe("CommandService", () => {
  it("実行したコマンドを Model に当ててから履歴に積む", () => {
    const { service } = setup();
    const command = fakeCommand();

    service.execute(command);

    expect(command.apply).toHaveBeenCalledExactlyOnceWith(model);
    expect(service.canUndo).toBe(true);
  });

  it("戻すと undo を当ててからやり直しの履歴へ移し、やり直すと apply を当て直す", () => {
    const { service } = setup();
    const command = fakeCommand();
    service.execute(command);

    service.undo();
    expect(command.undo).toHaveBeenCalledExactlyOnceWith(model);
    expect(service.canRedo).toBe(true);

    service.redo();
    expect(command.apply).toHaveBeenCalledTimes(2);
    expect(service.canUndo).toBe(true);
    expect(service.canRedo).toBe(false);
  });

  it("履歴が空なら戻しても、やり直しても何もしない", () => {
    const { service } = setup();

    expect(() => {
      service.undo();
      service.redo();
    }).not.toThrow();
    expect(service.canUndo).toBe(false);
  });

  it("apply が throw したコマンドは履歴に積まない", () => {
    const { service } = setup();
    const command: ICommand = { label: "bad", apply: throwing, undo: vi.fn() };

    expect(() => service.execute(command)).toThrow("boom");
    expect(service.canUndo).toBe(false);
  });

  it("undo が throw したコマンドは戻す側に残る", () => {
    const { service, history } = setup();
    const command: ICommand = { label: "bad", apply: vi.fn(), undo: throwing };
    service.execute(command);

    expect(() => service.undo()).toThrow("boom");
    expect(history.peekUndo()).toBe(command);
    expect(service.canRedo).toBe(false);
  });

  it("やり直しで apply が throw したコマンドはやり直す側に残る", () => {
    const { service, history } = setup();
    const command: ICommand = { label: "bad", apply: vi.fn(), undo: vi.fn() };
    service.execute(command);
    service.undo();
    command.apply = throwing;

    expect(() => service.redo()).toThrow("boom");
    expect(history.peekRedo()).toBe(command);
    expect(service.canUndo).toBe(false);
  });

  it("履歴の変化を onDidChangeHistory で通知する", () => {
    const { service } = setup();
    const listener = vi.fn();
    service.onDidChangeHistory(listener);

    service.execute(fakeCommand());
    service.undo();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
