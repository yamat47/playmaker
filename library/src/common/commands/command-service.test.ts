import { describe, expect, it, vi } from "vitest";
import type { IPlayModel } from "../model/play-model.js";
import type { IUndoRedoService } from "../undoRedo/undo-redo-service.js";
import type { ICommand } from "./command.js";
import { CommandService } from "./command-service.js";

const model = { tag: "model" } as unknown as IPlayModel;

describe("CommandService", () => {
  it("コマンドを Model へ適用してから Undo 履歴へ積む", () => {
    const calls: string[] = [];
    const command: ICommand = {
      label: "cmd",
      apply: vi.fn(() => calls.push("apply")),
      undo: vi.fn(),
    };
    const undoRedo = {
      push: vi.fn(() => calls.push("push")),
    } as unknown as IUndoRedoService;
    const svc = new CommandService(model, undoRedo);

    svc.execute(command);

    expect(command.apply).toHaveBeenCalledExactlyOnceWith(model);
    expect(undoRedo.push).toHaveBeenCalledExactlyOnceWith(command);
    // 履歴登録より前に適用が完了している。
    expect(calls).toEqual(["apply", "push"]);
  });
});
