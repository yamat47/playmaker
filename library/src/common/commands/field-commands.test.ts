import { describe, expect, it } from "vitest";
import { PlayModel } from "../model/play-model.js";
import { SetFieldZoneCommand } from "./field-commands.js";

describe("SetFieldZoneCommand", () => {
  it("apply でゾーン切替、undo で直前ゾーンへ戻す、redo で再切替", () => {
    const model = new PlayModel(); // 既定 middle
    const cmd = new SetFieldZoneCommand("redzone");

    cmd.apply(model);
    expect(model.getData().field.zone).toBe("redzone");

    cmd.undo(model);
    expect(model.getData().field.zone).toBe("middle");

    cmd.apply(model); // redo（直前ゾーンを再捕捉）
    expect(model.getData().field.zone).toBe("redzone");
  });

  it("apply 前の undo は throw する", () => {
    const model = new PlayModel();

    expect(() => new SetFieldZoneCommand("redzone").undo(model)).toThrow(/apply 未実行/);
  });
});
