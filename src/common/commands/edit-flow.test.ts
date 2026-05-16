// M4 の契約を通しで検証する統合テスト:
// CommandService → PlayModel → onDidChange、UndoRedoService 往復、選手削除のカスケード復元。

import { describe, expect, it, vi } from "vitest";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import { UndoRedoService } from "../undoRedo/undo-redo-service.js";
import { CommandService } from "./command-service.js";
import { AddLineCommand } from "./line-commands.js";
import { AddPlayerCommand, RemovePlayerCommand } from "./player-commands.js";

// noUncheckedIndexedAccess 下で `!` を使わず型を絞るためのテスト局所ヘルパ。
function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}

function wire(initial?: PlayData) {
  const model = new PlayModel(initial);
  const undoRedo = new UndoRedoService(model);
  const commands = new CommandService(model, undoRedo);
  const onChange = vi.fn<(data: PlayData) => void>();
  model.onDidChange(onChange);
  return { model, undoRedo, commands, onChange };
}

describe("編集フロー統合", () => {
  it("execute のたびに onChange が 1 回だけ発火する", () => {
    const { commands, onChange } = wire();

    commands.execute(
      new AddPlayerCommand({
        id: "qb",
        position: { lateralYard: 26, absoluteYard: 48 },
        shape: "circle",
        label: "QB",
      }),
    );

    expect(onChange).toHaveBeenCalledOnce();
    expect(must(onChange.mock.calls[0])[0].players.map((p) => p.id)).toEqual(["qb"]);
  });

  it("選手削除はカスケードでも 1 回発火、undo で線ごと完全復元", () => {
    const seed: PlayData = {
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "wr", position: { lateralYard: 4, absoluteYard: 50 }, shape: "circle", label: "WR" },
      ],
      lines: [
        {
          id: "r1",
          kind: "route",
          startPlayerId: "wr",
          waypoints: [],
          end: { lateralYard: 4, absoluteYard: 62 },
          interpolation: "straight",
        },
      ],
    };
    const { commands, undoRedo, onChange } = wire(seed);

    commands.execute(new RemovePlayerCommand("wr"));
    expect(onChange).toHaveBeenCalledTimes(1); // 選手+線の除去でも 1 回
    expect(must(onChange.mock.lastCall)[0]).toEqual({
      version: 1,
      field: { zone: "middle" },
      players: [],
      lines: [],
    });

    undoRedo.undo();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(must(onChange.mock.lastCall)[0]).toEqual(seed);

    undoRedo.redo();
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(must(onChange.mock.lastCall)[0].lines).toEqual([]);
  });

  it("複数編集を LIFO で undo / redo し履歴フラグが整合する", () => {
    const { commands, undoRedo, model } = wire();
    commands.execute(
      new AddPlayerCommand({
        id: "p",
        position: { lateralYard: 5, absoluteYard: 50 },
        shape: "circle",
        label: "p",
      }),
    );
    commands.execute(
      new AddLineCommand({
        id: "l",
        kind: "route",
        startPlayerId: "p",
        waypoints: [],
        end: { lateralYard: 5, absoluteYard: 60 },
        interpolation: "straight",
      }),
    );

    undoRedo.undo(); // 線を取り消し
    expect(model.getData().lines).toEqual([]);
    expect(model.getData().players.map((p) => p.id)).toEqual(["p"]);
    undoRedo.undo(); // 選手を取り消し
    expect(model.getData().players).toEqual([]);
    expect(undoRedo.canUndo).toBe(false);
    expect(undoRedo.canRedo).toBe(true);

    undoRedo.redo();
    undoRedo.redo();
    expect(model.getData().lines.map((l) => l.id)).toEqual(["l"]);

    // 新規編集で redo 履歴が破棄される
    undoRedo.undo(); // 線を取り消し → redo スタックに AddLineCommand が乗る
    expect(undoRedo.canRedo).toBe(true);
    commands.execute(
      new AddPlayerCommand({
        id: "q",
        position: { lateralYard: 9, absoluteYard: 50 },
        shape: "circle",
        label: "q",
      }),
    );
    expect(undoRedo.canRedo).toBe(false);
    expect(undoRedo.canUndo).toBe(true);
    expect(model.getData().players.map((p) => p.id)).toEqual(["p", "q"]);
    expect(model.getData().lines).toEqual([]);
  });
});
