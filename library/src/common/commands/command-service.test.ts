import { describe, expect, it, vi } from "vitest";
import { player } from "../../test-support/fixtures.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import type { ICommand } from "./command.js";
import { CommandService } from "./command-service.js";
import { AddPlayerCommand } from "./player-commands.js";
import { UndoRedoService } from "./undo-redo-service.js";

function wire() {
  const model = new PlayModel();
  const commands = new CommandService(model, new UndoRedoService());
  return { model, commands };
}

function failing(on: "apply" | "undo"): ICommand {
  return {
    label: "失敗するコマンド",
    apply: vi.fn(() => {
      if (on === "apply") {
        throw new Error("apply failed");
      }
      return true;
    }),
    undo: vi.fn(() => {
      throw new Error("undo failed");
    }),
  };
}

describe("CommandService", () => {
  it("execute はコマンドを Model に当て、undo できるようにする", () => {
    const { model, commands } = wire();

    const changed = commands.execute(new AddPlayerCommand(player("a")));

    expect(changed).toBe(true);
    expect(model.findPlayer("a")).toEqual(player("a"));
    expect(commands.canUndo).toBe(true);
  });

  it("undo は最後のコマンドを取り消し、redo はそれをやり直す", () => {
    const { model, commands } = wire();
    commands.execute(new AddPlayerCommand(player("a")));

    commands.undo();
    expect(model.hasPlayer("a")).toBe(false);
    expect(commands.canRedo).toBe(true);

    commands.redo();
    expect(model.hasPlayer("a")).toBe(true);
    expect(commands.canRedo).toBe(false);
  });

  it("何も変えなかったと返したコマンドは履歴に積まない", () => {
    const { commands } = wire();
    const history = vi.fn();
    commands.onDidChangeHistory(history);

    const changed = commands.execute({
      label: "何も変えないコマンド",
      apply: () => false,
      undo: vi.fn(),
    });

    expect(changed).toBe(false);
    expect(commands.canUndo).toBe(false);
    expect(history).not.toHaveBeenCalled();
  });

  it("適用が throw したコマンドは履歴に積まない", () => {
    const { commands } = wire();

    expect(() => commands.execute(failing("apply"))).toThrow("apply failed");

    expect(commands.canUndo).toBe(false);
  });

  it("取り消しが throw したコマンドは、redo の側へ移らず履歴に残る", () => {
    const { commands } = wire();
    commands.execute(failing("undo"));

    expect(() => commands.undo()).toThrow("undo failed");

    expect(commands.canUndo).toBe(true);
    expect(commands.canRedo).toBe(false);
  });

  it("無い id を消すコマンドが throw しても、状態も履歴も変わらない", () => {
    const { model, commands } = wire();
    commands.execute(new AddPlayerCommand(player("a")));
    const before = model.getSnapshot();
    const removeMissing: ICommand = {
      label: "複数の削除",
      apply: (m) => {
        m.removePlayers(["a", "ghost"]);
        return true;
      },
      undo: vi.fn(),
    };

    expect(() => commands.execute(removeMissing)).toThrow('unknown or repeated player id "ghost"');

    expect(model.getSnapshot()).toBe(before);
    expect(commands.canUndo).toBe(true);
    commands.undo();
    expect(model.hasPlayer("a")).toBe(false);
  });

  it("履歴の通知は Model の通知より後に来る", () => {
    const { model, commands } = wire();
    const order: string[] = [];
    model.onDidChange((_: PlayData) => order.push("model"));
    commands.onDidChangeHistory(() => order.push("history"));

    commands.execute(new AddPlayerCommand(player("a")));
    commands.undo();

    expect(order).toEqual(["model", "history", "model", "history"]);
  });
});
