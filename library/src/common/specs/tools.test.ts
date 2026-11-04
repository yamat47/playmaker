import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("Tool switching", () => {
  it("starts with the select tool and nothing selected right after opening", () => {
    const play = openPlay(twoPlayersWithRoute());

    expect(play.editor.getViewState()).toMatchObject({
      tool: "select",
      selection: { kind: "none" },
    });
  });

  it("changes the tool in the view state when switched", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.setTool("add-player");

    expect(play.editor.getViewState().tool).toBe("add-player");
  });

  it("does not notify when the current tool is selected again", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.setTool("select");

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("notifies the scene and the view state once each when switched while drawing", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));
    play.notified.mockClear();

    play.editor.setTool("select");

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});
