import { describe, expect, it, vi } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import type { PlayData } from "../model/play-data.js";
import { PlayModel } from "../model/play-model.js";
import {
  AddLineCommand,
  applyLinePatch,
  RemoveLineCommand,
  UpdateLineCommand,
} from "./line-commands.js";

function seed(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a")],
    lines: [line("l1"), line("l2"), line("l3")],
  };
}

describe("AddLineCommand", () => {
  it("apply で線を足し、undo で除き、もう一度 apply すると同じ線が戻る", () => {
    const model = new PlayModel({ ...seed(), lines: [] });
    const cmd = new AddLineCommand(line("x"));

    cmd.apply(model);
    expect(model.getData().lines).toEqual([line("x")]);

    cmd.undo(model);
    expect(model.getData().lines).toEqual([]);

    cmd.apply(model);
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

    cmd.apply(model);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["l1", "l3"]);
  });

  it("apply より前に undo すると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new RemoveLineCommand("l1").undo(model)).toThrow(
      "線の削除: apply より前に undo された",
    );
  });
});

describe("applyLinePatch", () => {
  it("パッチで指定したキーだけを差し替え、ほかのキーは今の値を保つ", () => {
    const current = { ...line("l1"), color: "#abc" };
    const end = { lateralYard: 12, downfieldYard: 70 };

    expect(applyLinePatch(current, { kind: "block", end })).toEqual({
      ...current,
      kind: "block",
      end,
    });
  });

  it("色と太さに null を渡すとキーごと消す", () => {
    const current = { ...line("l1"), color: "#abc", thickness: 2 };

    const next = applyLinePatch(current, { color: null, thickness: null });

    expect(next).toEqual(line("l1"));
    expect(next).not.toHaveProperty("color");
    expect(next).not.toHaveProperty("thickness");
  });

  it("元の線は書き換えない", () => {
    const current = line("l1");

    applyLinePatch(current, { kind: "block" });

    expect(current).toEqual(line("l1"));
  });
});

describe("UpdateLineCommand", () => {
  it("apply でパッチを当て、undo で当てる前の線に戻す", () => {
    const model = new PlayModel(seed());
    const waypoints = [{ lateralYard: 10, downfieldYard: 55 }];
    const cmd = new UpdateLineCommand("l1", { interpolation: "bezier", waypoints, thickness: 4 });

    cmd.apply(model);
    expect(model.findLine("l1")).toEqual({
      ...line("l1"),
      interpolation: "bezier",
      waypoints,
      thickness: 4,
    });

    cmd.undo(model);
    expect(model.findLine("l1")).toEqual(line("l1"));
  });

  it("構築したあとで渡したパッチを書き換えても、当てる内容は変わらない", () => {
    const model = new PlayModel(seed());
    const patch: { kind: "block" | "motion" } = { kind: "block" };
    const cmd = new UpdateLineCommand("l1", patch);
    patch.kind = "motion";

    cmd.apply(model);

    expect(model.findLine("l1")?.kind).toBe("block");
  });

  it("今と同じ値だけのパッチは Model に触れず、何も変えなかったと返す", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const changed = new UpdateLineCommand("l1", { kind: "route", thickness: null }).apply(model);

    expect(changed).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("無い id の線に apply すると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new UpdateLineCommand("ghost", { kind: "block" }).apply(model)).toThrow(
      /unknown line id "ghost"/,
    );
  });

  it("apply より前に undo すると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => new UpdateLineCommand("l1", {}).undo(model)).toThrow(
      "線の編集: apply より前に undo された",
    );
  });
});
