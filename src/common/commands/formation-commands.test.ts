import { describe, expect, it, vi } from "vitest";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import { UndoRedoService } from "../undoRedo/undo-redo-service.js";
import { CommandService } from "./command-service.js";
import { LoadFormationCommand } from "./formation-commands.js";

// noUncheckedIndexedAccess 下で `!` を使わず型を絞るためのテスト局所ヘルパ。
function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}

function formationPlayers(): Player[] {
  return [
    { id: "f-1", position: { lateralYard: 5, absoluteYard: 50 }, shape: "circle", label: "C" },
    {
      id: "f-2",
      position: { lateralYard: 9, absoluteYard: 50 },
      shape: "square",
      label: "G",
      color: "#c62828",
    },
  ];
}

describe("LoadFormationCommand", () => {
  it("日本語ラベルを持つ", () => {
    expect(new LoadFormationCommand([]).label).toBe("フォーメーションの読み込み");
  });

  it("apply は既存選手を保ったまま一括追加し 1 回発火、undo で一括削除、redo で再追加", () => {
    const model = new PlayModel({
      version: 1,
      field: { zone: "middle" },
      players: [
        { id: "e-1", position: { lateralYard: 1, absoluteYard: 1 }, shape: "circle", label: "E" },
      ],
      lines: [],
    });
    const undoRedo = new UndoRedoService(model);
    const commands = new CommandService(model, undoRedo);
    const onChange = vi.fn<(data: PlayData) => void>();
    model.onDidChange(onChange);

    commands.execute(new LoadFormationCommand(formationPlayers()));
    expect(onChange).toHaveBeenCalledOnce(); // 一括でも 1 回（M4 契約）
    expect(model.getData().players.map((p) => p.id)).toEqual(["e-1", "f-1", "f-2"]);
    expect(model.findPlayer("f-2")?.color).toBe("#c62828");

    undoRedo.undo();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(model.getData().players.map((p) => p.id)).toEqual(["e-1"]);

    undoRedo.redo();
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(model.getData().players.map((p) => p.id)).toEqual(["e-1", "f-1", "f-2"]);
  });

  it("構築後に入力配列・要素を書き換えても保持データは揺れない（redo 安定）", () => {
    const input = formationPlayers();
    const command = new LoadFormationCommand(input);
    must(input[0]).label = "tampered";
    input.length = 0;

    const model = new PlayModel();
    command.apply(model);

    expect(model.findPlayer("f-1")?.label).toBe("C");
    expect(model.getData().players).toHaveLength(2);
  });
});
