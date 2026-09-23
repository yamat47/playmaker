import { describe, expect, it } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { mutable } from "../../test-support/mutable.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import { AddLineCommand, RemoveLineCommand, UpdateLineCommand } from "./line-commands.js";

function seed(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a")],
    lines: [line("l1"), line("l2"), line("l3")],
  };
}

describe("AddLineCommand", () => {
  it("apply で追加、undo で除去、redo で復帰、構築後の改変は無効", () => {
    const model = new PlayModel({ ...seed(), lines: [] });
    const input = line("x");
    const cmd = new AddLineCommand(input);
    mutable(input).kind = "block";

    cmd.apply(model);
    expect(model.getData().lines).toEqual([line("x")]);

    cmd.undo(model);
    expect(model.getData().lines).toEqual([]);

    cmd.apply(model); // redo
    expect(model.getData().lines).toEqual([line("x")]);
  });
});

describe("RemoveLineCommand", () => {
  it("apply で削除、undo で元の位置へ復元、redo で再削除", () => {
    const model = new PlayModel(seed());
    const cmd = new RemoveLineCommand("l2");

    cmd.apply(model);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["l1", "l3"]);

    cmd.undo(model);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["l1", "l2", "l3"]);

    cmd.apply(model); // redo
    expect(model.getData().lines.map((l) => l.id)).toEqual(["l1", "l3"]);
  });

  it("apply 前の undo は throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new RemoveLineCommand("l1").undo(model)).toThrow(/apply 未実行/);
  });
});

describe("UpdateLineCommand", () => {
  it("指定プロパティのみ上書きし undo で戻す", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdateLineCommand("l1", {
      kind: "block",
      interpolation: "bezier",
      color: "#abc",
      thickness: 4,
    });

    cmd.apply(model);
    expect(model.findLine("l1")).toEqual({
      ...line("l1"),
      kind: "block",
      interpolation: "bezier",
      color: "#abc",
      thickness: 4,
    });

    cmd.undo(model);
    expect(model.findLine("l1")).toEqual(line("l1"));
  });

  it("色と太さに null を渡すと値を消して既定に戻し、undo で元の値に戻す", () => {
    const model = new PlayModel(seed());
    new UpdateLineCommand("l1", { color: "#abc", thickness: 2 }).apply(model);
    const cmd = new UpdateLineCommand("l1", { color: null, thickness: null });

    cmd.apply(model);
    expect(model.findLine("l1")).toEqual(line("l1"));

    cmd.undo(model);
    expect(model.findLine("l1")).toEqual({ ...line("l1"), color: "#abc", thickness: 2 });
  });

  it("空 patch は現状維持（全項目の未指定分岐）", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdateLineCommand("l1", {});

    cmd.apply(model);

    expect(model.findLine("l1")).toEqual(line("l1"));
  });

  it("未知 id の apply と apply 前 undo は throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new UpdateLineCommand("ghost", { kind: "block" }).apply(model)).toThrow(
      /unknown line id "ghost"/,
    );
    expect(() => new UpdateLineCommand("l1", {}).undo(model)).toThrow(/apply 未実行/);
  });
});

describe("UpdateLineCommand の形の編集", () => {
  it("waypoint 列を差し替え、undo で元へ戻す", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdateLineCommand("l1", {
      waypoints: [{ lateralYard: 10, downfieldYard: 55 }],
    });

    cmd.apply(model);
    expect(model.findLine("l1")?.waypoints).toEqual([{ lateralYard: 10, downfieldYard: 55 }]);

    cmd.undo(model);
    expect(model.findLine("l1")?.waypoints).toEqual([]);
  });

  it("終点だけを差し替えると waypoint は変わらず、undo で元へ戻す", () => {
    const model = new PlayModel(seed());
    const cmd = new UpdateLineCommand("l1", { end: { lateralYard: 12, downfieldYard: 70 } });

    cmd.apply(model);
    expect(model.findLine("l1")?.end).toEqual({ lateralYard: 12, downfieldYard: 70 });
    expect(model.findLine("l1")?.waypoints).toEqual([]);

    cmd.undo(model);
    expect(model.findLine("l1")).toEqual(line("l1"));
  });
});
