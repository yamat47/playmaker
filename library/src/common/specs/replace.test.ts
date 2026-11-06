import { describe, expect, it } from "vitest";
import { playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import { CURRENT_PLAY_DATA_VERSION } from "../model/play-data.js";

/** One player in the red zone, a stand-in for a template applied to the diagram. */
function template() {
  return {
    version: CURRENT_PLAY_DATA_VERSION,
    field: { zone: "redzone" as const, losYard: 85 },
    players: [player("qb", 26.5, -5)],
    lines: [],
  };
}

describe("Replacing the whole diagram as an edit", () => {
  it("shows the new diagram, field included", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.replacePlayData(template());

    expect(play.session.getPlayData()).toEqual(template());
  });

  it("brings the previous diagram back with one Undo", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.replacePlayData(template());

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("brings the new diagram back with Redo after Undo", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.replacePlayData(template());
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(template());
  });

  it("passes the new diagram to onChange once", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.replacePlayData(template());

    expect(play.onChange).toHaveBeenCalledExactlyOnceWith(template());
  });

  it("keeps the edits made before it in the history", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("own-redzone");
    play.session.replacePlayData(template());

    play.editor.undo();
    play.editor.undo();

    expect(play.session.fieldZone).toBe("middle");
  });

  it("clears a selection whose id the new diagram gives to another player", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.session.replacePlayData(playData([player("a", 30, 0)]));

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("clears a selection whose id the diagram brought back by Undo gives to another player", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.replacePlayData(playData([player("a", 30, 0)]));
    play.click(yd(30, 0));

    play.editor.undo();

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("clears a selection whose id the diagram brought back by Redo gives to another player", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.replacePlayData(playData([player("a", 30, 0)]));
    play.editor.undo();
    play.click(yd(10, 0));

    play.editor.redo();

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("neither records history nor notifies when the diagram shown is applied again", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.replacePlayData(twoPlayersWithRoute());

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("keeps the selection when the diagram shown is applied again", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.session.replacePlayData(twoPlayersWithRoute());

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });

  it("commits a label still being typed before replacing, so Undo brings it back", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.editor.previewLabel("QB");
    play.session.replacePlayData(template());

    play.editor.undo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("ends a drawing in progress", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.session.replacePlayData(template());

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("normalizes the input like a load, giving a repeated id a new one", () => {
    const play = openPlay(playData());

    play.session.replacePlayData(playData([player("p", 10, 0), player("p", 20, 0)]));

    const ids = play.session.getPlayData().players.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });
});
