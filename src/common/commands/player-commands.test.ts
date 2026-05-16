import { describe, expect, it } from "vitest";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import type { Player } from "../model/player.js";
import {
  AddPlayerCommand,
  MovePlayerCommand,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "./player-commands.js";

function player(id: string, lateralYard = 5, absoluteYard = 50): Player {
  return { id, position: { lateralYard, absoluteYard }, shape: "circle", label: id };
}

function seed(): PlayData {
  return {
    version: 1,
    field: { zone: "middle" },
    players: [player("a")],
    lines: [
      {
        id: "la",
        kind: "route",
        startPlayerId: "a",
        waypoints: [],
        end: { lateralYard: 5, absoluteYard: 60 },
        interpolation: "straight",
      },
    ],
  };
}

describe("AddPlayerCommand", () => {
  it("apply で追加し undo で除去、redo で復帰する", () => {
    const model = new PlayModel();
    const input = player("p1");
    const cmd = new AddPlayerCommand(input);
    input.label = "tampered"; // 構築後の改変は redo に影響しない

    cmd.apply(model);
    expect(model.getData().players).toEqual([player("p1")]);

    cmd.undo(model);
    expect(model.getData().players).toEqual([]);

    cmd.apply(model); // redo
    expect(model.getData().players).toEqual([player("p1")]);
  });
});

describe("RemovePlayerCommand", () => {
  it("apply で従属線ごと削除、undo で完全復元、redo で再削除", () => {
    const model = new PlayModel(seed());
    const cmd = new RemovePlayerCommand("a");

    cmd.apply(model);
    expect(model.getData().players).toEqual([]);
    expect(model.getData().lines).toEqual([]);

    cmd.undo(model);
    expect(model.getData()).toEqual(seed());

    cmd.apply(model); // redo
    expect(model.getData().players).toEqual([]);
  });

  it("apply 前の undo は throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new RemovePlayerCommand("a").undo(model)).toThrow(/apply 未実行/);
  });
});

describe("MovePlayerCommand", () => {
  it("apply で位置変更、undo で元位置へ戻す", () => {
    const model = new PlayModel(seed());
    const dest = { lateralYard: 20, absoluteYard: 70 };
    const cmd = new MovePlayerCommand("a", dest);
    dest.lateralYard = 999; // 構築後の改変は影響しない

    cmd.apply(model);
    expect(model.findPlayer("a")?.position).toEqual({ lateralYard: 20, absoluteYard: 70 });

    cmd.undo(model);
    expect(model.findPlayer("a")?.position).toEqual({ lateralYard: 5, absoluteYard: 50 });
  });

  it("未知 id の apply と apply 前 undo は throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new MovePlayerCommand("ghost", player("x").position).apply(model)).toThrow(
      /unknown player id "ghost"/,
    );
    expect(() => new MovePlayerCommand("a", player("a").position).undo(model)).toThrow(
      /apply 未実行/,
    );
  });
});

describe("UpdatePlayerCommand", () => {
  it("指定プロパティのみ上書きし undo で戻す", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdatePlayerCommand("a", { label: "QB", shape: "square", color: "#0f0" });

    cmd.apply(model);
    expect(model.findPlayer("a")).toEqual({
      id: "a",
      position: { lateralYard: 5, absoluteYard: 50 },
      shape: "square",
      label: "QB",
      color: "#0f0",
    });

    cmd.undo(model);
    expect(model.findPlayer("a")).toEqual(player("a"));
  });

  it("空 patch は現状維持（全項目の未指定分岐）", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdatePlayerCommand("a", {});

    cmd.apply(model);

    expect(model.findPlayer("a")).toEqual(player("a"));
  });

  it("未知 id の apply と apply 前 undo は throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new UpdatePlayerCommand("ghost", { label: "x" }).apply(model)).toThrow(
      /unknown player id "ghost"/,
    );
    expect(() => new UpdatePlayerCommand("a", {}).undo(model)).toThrow(/apply 未実行/);
  });
});
