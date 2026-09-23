import { describe, expect, it } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import {
  AddPlayerCommand,
  applyPlayerPatch,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "./player-commands.js";

function seed(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a")],
    lines: [line("la")],
  };
}

describe("AddPlayerCommand", () => {
  it("apply で選手を足し、undo で除き、もう一度 apply すると同じ選手が戻る", () => {
    const model = new PlayModel();
    const cmd = new AddPlayerCommand(player("p1"));

    cmd.apply(model);
    expect(model.getData().players).toEqual([player("p1")]);

    cmd.undo(model);
    expect(model.getData().players).toEqual([]);

    cmd.apply(model);
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

    cmd.apply(model);
    expect(model.getData().players).toEqual([]);
  });

  it("apply より前に undo すると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new RemovePlayerCommand("a").undo(model)).toThrow(
      "選手の削除: apply より前に undo された",
    );
  });
});

describe("applyPlayerPatch", () => {
  it("パッチで指定したキーだけを差し替え、ほかのキーは今の値を保つ", () => {
    const current = { ...player("a"), color: "#0f0" };
    const position = { lateralYard: 20, downfieldYard: 5 };

    expect(applyPlayerPatch(current, { position, label: "QB" })).toEqual({
      ...current,
      position,
      label: "QB",
    });
  });

  it("色に null を渡すとキーごと消す", () => {
    const next = applyPlayerPatch({ ...player("a"), color: "#0f0" }, { color: null });

    expect(next).toEqual(player("a"));
    expect(next).not.toHaveProperty("color");
  });
});

describe("UpdatePlayerCommand", () => {
  it("apply でパッチを当て、undo で当てる前の選手に戻す", () => {
    const model = new PlayModel(seed());
    const position = { lateralYard: 20, downfieldYard: 5 };
    const cmd = new UpdatePlayerCommand("a", { position, shape: "square", color: "#0f0" });

    cmd.apply(model);
    expect(model.findPlayer("a")).toEqual({
      ...player("a"),
      position,
      shape: "square",
      color: "#0f0",
    });

    cmd.undo(model);
    expect(model.findPlayer("a")).toEqual(player("a"));
  });

  it("構築したあとで渡したパッチを書き換えても、当てる内容は変わらない", () => {
    const model = new PlayModel(seed());
    const patch = { label: "QB" };
    const cmd = new UpdatePlayerCommand("a", patch);
    patch.label = "RB";

    cmd.apply(model);

    expect(model.findPlayer("a")?.label).toBe("QB");
  });

  it("無い id の選手に apply すると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new UpdatePlayerCommand("ghost", { label: "x" }).apply(model)).toThrow(
      'UpdatePlayerCommand: unknown player id "ghost"',
    );
  });

  it("apply より前に undo すると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new UpdatePlayerCommand("a", {}).undo(model)).toThrow(
      "選手の編集: apply より前に undo された",
    );
  });
});
