import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("Zone switching", () => {
  it("changes the zone of the diagram and the view state when switched", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("redzone");

    expect(play.session.fieldZone).toBe("redzone");
    expect(play.editor.getViewState().fieldZone).toBe("redzone");
  });

  it("keeps the positions of players and lines relative to the LOS when switched", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("redzone");

    const { players, lines } = twoPlayersWithRoute();
    expect(play.session.getPlayData()).toMatchObject({ players, lines });
  });

  it("restores the original zone and LOS when Undo follows a switch", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("switches again when Redo follows Undo", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    const switched = play.session.getPlayData();
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(switched);
  });

  it("neither records history nor notifies when the current zone is selected again", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("middle");

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("stops the drawing in progress when switched", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.session.setFieldZone("redzone");

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("keeps the drawing in progress when the current zone is selected again", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.session.setFieldZone("middle");

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });
});
