import { describe, expect, it } from "vitest";
import type { Line } from "../model/line.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import {
  AddLineCommand,
  RemoveLineCommand,
  SetLineWaypointsCommand,
  UpdateLineCommand,
} from "./line-commands.js";

// noUncheckedIndexedAccess 下で `!` を使わず型を絞るためのテスト局所ヘルパ。
function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}

function line(id: string, startPlayerId = "a"): Line {
  return {
    id,
    kind: "route",
    startPlayerId,
    waypoints: [],
    end: { lateralYard: 5, absoluteYard: 60 },
    interpolation: "straight",
  };
}

function seed(): PlayData {
  return {
    version: 1,
    field: { zone: "middle" },
    players: [
      { id: "a", position: { lateralYard: 5, absoluteYard: 50 }, shape: "circle", label: "a" },
    ],
    lines: [line("l1"), line("l2"), line("l3")],
  };
}

describe("AddLineCommand", () => {
  it("apply で追加、undo で除去、redo で復帰、構築後の改変は無効", () => {
    const model = new PlayModel({ ...seed(), lines: [] });
    const input = line("x");
    const cmd = new AddLineCommand(input);
    input.kind = "block";

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

describe("SetLineWaypointsCommand", () => {
  it("waypoint 列を差し替え、undo で元へ戻す。構築後の改変は無効", () => {
    const model = new PlayModel(seed());
    const wps = [{ lateralYard: 10, absoluteYard: 55 }];
    const cmd = new SetLineWaypointsCommand("l1", wps);
    must(wps[0]).lateralYard = 999;

    cmd.apply(model);
    expect(model.findLine("l1")?.waypoints).toEqual([{ lateralYard: 10, absoluteYard: 55 }]);

    cmd.undo(model);
    expect(model.findLine("l1")?.waypoints).toEqual([]);
  });

  it("未知 id の apply と apply 前 undo は throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new SetLineWaypointsCommand("ghost", []).apply(model)).toThrow(
      /unknown line id "ghost"/,
    );
    expect(() => new SetLineWaypointsCommand("l1", []).undo(model)).toThrow(/apply 未実行/);
  });
});
