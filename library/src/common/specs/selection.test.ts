import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

/** A state where Undo removed the added and selected player. The selection still points at it. */
function openWithVanishedSelection() {
  const play = openPlay(twoPlayersWithRoute());
  play.editor.setTool("add-player");
  play.click(yd(30, -5));
  play.editor.setTool("select");
  play.editor.undo();
  return play;
}

describe("Selection by click", () => {
  it("selects the player when a player is clicked", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });

  it("draws the player highlighted when it is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getFrame().overlay).toEqual({ kind: "player", playerId: "a" });
  });

  it("returns the selected player and no selected line when a player is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getSelectedPlayer()?.id).toBe("a");
    expect(play.editor.getSelectedLine()).toBeUndefined();
  });

  it("selects the line when a line is clicked", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(25, 5));

    expect(play.editor.getViewState().selection).toEqual({ kind: "line", id: "l" });
  });

  it("draws handles at the waypoints and the end when a line is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(25, 5));

    expect(play.editor.getFrame().overlay).toEqual({
      kind: "line",
      waypointHandles: [yd(15, 2)],
      endpointHandle: yd(25, 5),
    });
  });

  it("clears the selection when empty space is clicked", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.click(yd(45, -10));

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("does not notify when empty space is clicked while nothing is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(45, -10));

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("does not notify the view state when the selected player is clicked again", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.notified.mockClear();

    play.click(yd(10, 0));

    expect(play.notified).not.toHaveBeenCalledWith("view");
  });

  it("moves the selection to another player when that player is pressed", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.click(yd(20, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "b" });
  });

  it("notifies the scene and the view state once each when another player is pressed", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.notified.mockClear();

    play.editor.pointerDown(yd(20, 0));

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("Selection of a vanished target", () => {
  it("shows no selection in the view state when Undo removes the selected player", () => {
    const play = openWithVanishedSelection();

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("returns no selected player when Undo removes the selected player", () => {
    const play = openWithVanishedSelection();

    expect(play.editor.getSelectedPlayer()).toBeUndefined();
  });

  it("reads as the selection again when Redo restores the vanished player", () => {
    const play = openWithVanishedSelection();

    play.editor.redo();

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "player-1" });
  });
});

describe("Deleting the selection", () => {
  it("clears the selection when the selected player is deleted", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(20, 0));

    play.editor.deleteSelection();

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("keeps the diagram and history and does not notify on delete with nothing selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("does not record history when deleting after the selected player vanished", () => {
    const play = openWithVanishedSelection();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});
