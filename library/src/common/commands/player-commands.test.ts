import { describe, expect, it } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { mutable } from "../../test-support/mutable.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import { AddPlayerCommand, RemovePlayerCommand, UpdatePlayerCommand } from "./player-commands.js";

function seed(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a")],
    lines: [line("la")],
  };
}

describe("AddPlayerCommand", () => {
  it("apply で追加し undo で除去、redo で復帰する", () => {
    const model = new PlayModel();
    const input = player("p1");
    const cmd = new AddPlayerCommand(input);
    mutable(input).label = "tampered"; // 構築後の改変は redo に影響しない

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

describe("UpdatePlayerCommand の移動", () => {
  it("位置だけを差し替え、undo で元の位置へ戻す", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdatePlayerCommand("a", { position: { lateralYard: 20, downfieldYard: 70 } });

    cmd.apply(model);
    expect(model.findPlayer("a")).toEqual({
      ...player("a"),
      position: { lateralYard: 20, downfieldYard: 70 },
    });

    cmd.undo(model);
    expect(model.findPlayer("a")).toEqual(player("a"));
  });
});

describe("UpdatePlayerCommand", () => {
  it("指定プロパティのみ上書きし undo で戻す", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdatePlayerCommand("a", { label: "QB", shape: "square", color: "#0f0" });

    cmd.apply(model);
    expect(model.findPlayer("a")).toEqual({
      id: "a",
      position: { lateralYard: 5, downfieldYard: 50 },
      shape: "square",
      label: "QB",
      color: "#0f0",
    });

    cmd.undo(model);
    expect(model.findPlayer("a")).toEqual(player("a"));
  });

  it("色に null を渡すと値を消して既定に戻し、undo で元の色に戻す", () => {
    const model = new PlayModel(seed());
    new UpdatePlayerCommand("a", { color: "#0f0" }).apply(model);
    const cmd = new UpdatePlayerCommand("a", { color: null });

    cmd.apply(model);
    expect(model.findPlayer("a")).toEqual(player("a"));

    cmd.undo(model);
    expect(model.findPlayer("a")?.color).toBe("#0f0");
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
