import { describe, expect, it } from "vitest";
import { positionOf, twoPlayersWithRoute } from "../../test-support/fixtures.js";
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

describe("Stepping back", () => {
  it("cancels a drawing in progress and keeps the tool", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.editor.stepBack();

    expect(play.editor.getViewState()).toMatchObject({ isDrawing: false, tool: "route" });
  });

  it("cancels a drag in progress and leaves the player where it was grabbed", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(14, 3));

    play.editor.stepBack();
    play.editor.pointerUp(yd(14, 3));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(10, 0));
  });

  it("clears the selection and keeps the tool when nothing is in progress", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");
    play.click(yd(30, -5));

    play.editor.stepBack();

    expect(play.editor.getViewState()).toMatchObject({
      selection: { kind: "none" },
      tool: "add-player",
    });
  });

  it("returns to the select tool when nothing is selected", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");

    play.editor.stepBack();

    expect(play.editor.getViewState().tool).toBe("select");
  });

  it("does not notify when there is nothing to step back from", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.stepBack();

    expect(play.notified).not.toHaveBeenCalled();
  });
});
