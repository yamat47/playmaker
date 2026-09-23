import { describe, expect, it, vi } from "vitest";
import { PlayModel } from "../model/play-model.js";
import { SetFieldZoneCommand } from "./field-commands.js";

describe("SetFieldZoneCommand", () => {
  it("apply でゾーン切替、undo で直前ゾーンへ戻す、redo で再切替", () => {
    const model = new PlayModel(); // 既定 middle
    const cmd = new SetFieldZoneCommand("redzone");

    cmd.apply(model);
    expect(model.getData().field.zone).toBe("redzone");

    cmd.undo(model);
    expect(model.getData().field).toEqual({ zone: "middle", losYard: 50 });

    cmd.apply(model); // redo（直前ゾーンを再捕捉）
    expect(model.getData().field.zone).toBe("redzone");
  });

  it("今と同じゾーンへの切り替えは Model に触れず、何も変えなかったと返す", () => {
    const model = new PlayModel();
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(new SetFieldZoneCommand("middle").apply(model)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("apply 前の undo は throw する", () => {
    const model = new PlayModel();

    expect(() => new SetFieldZoneCommand("redzone").undo(model)).toThrow(
      /apply より前に undo された/,
    );
  });
});
