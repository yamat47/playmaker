import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("ツールの切替", () => {
  it("開いた直後は、選択ツールで何も選んでいない", () => {
    const play = openPlay(twoPlayersWithRoute());

    expect(play.editor.getViewState()).toMatchObject({ tool: "select", selection: null });
  });

  it("切り替えると、表示状態のツールが変わる", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.setTool("add-player");

    expect(play.editor.getViewState().tool).toBe("add-player");
  });

  it("今と同じツールを選び直しても、通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.setTool("select");

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("作図の途中で切り替えると、描く図と表示状態の通知を 1 回ずつ出す", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));
    play.notified.mockClear();

    play.editor.setTool("select");

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});
