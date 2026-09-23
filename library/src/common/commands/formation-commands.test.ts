import { describe, expect, it, vi } from "vitest";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import { CommandService } from "./command-service.js";
import { LoadFormationCommand } from "./formation-commands.js";
import { UndoRedoService } from "./undo-redo-service.js";

function formationPlayers(): Player[] {
  return [
    { id: "f-1", position: { lateralYard: 5, downfieldYard: 50 }, shape: "circle", label: "C" },
    {
      id: "f-2",
      position: { lateralYard: 9, downfieldYard: 50 },
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
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [
        { id: "e-1", position: { lateralYard: 1, downfieldYard: 1 }, shape: "circle", label: "E" },
      ],
      lines: [],
    });
    const commands = new CommandService(model, new UndoRedoService());
    const onChange = vi.fn<(data: PlayData) => void>();
    model.onDidChange(onChange);

    commands.execute(new LoadFormationCommand(formationPlayers()));
    expect(onChange).toHaveBeenCalledOnce(); // 一括でも 1 回
    expect(model.getData().players.map((p) => p.id)).toEqual(["e-1", "f-1", "f-2"]);
    expect(model.findPlayer("f-2")?.color).toBe("#c62828");

    commands.undo();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(model.getData().players.map((p) => p.id)).toEqual(["e-1"]);

    commands.redo();
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(model.getData().players.map((p) => p.id)).toEqual(["e-1", "f-1", "f-2"]);
  });
});
