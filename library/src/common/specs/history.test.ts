import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, type PlayDriver, yd } from "../../test-support/play-driver.js";

/** A diagram that added one player and then switched the zone. */
function openAfterTwoEdits(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.editor.setTool("add-player");
  play.click(yd(30, -5));
  play.editor.setTool("select");
  play.session.setFieldZone("redzone");
  return play;
}

/** A diagram that switched the zone and is now in the middle of dragging player a. */
function openDraggingAfterZoneSwitch(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.session.setFieldZone("redzone");
  play.editor.pointerDown(yd(10, 0));
  play.editor.pointerMove(yd(12, 2));
  return play;
}

/** A diagram that undid a zone switch and then started drawing from player a. */
function openDrawingWithRedo(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.session.setFieldZone("redzone");
  play.editor.undo();
  play.startLine(yd(10, 0));
  return play;
}

function playerIds(play: PlayDriver): string[] {
  return play.session.getPlayData().players.map((p) => p.id);
}

describe("Undo and Redo", () => {
  it("allows neither Undo nor Redo right after opening", () => {
    const play = openPlay(twoPlayersWithRoute());

    expect(play.editor.getViewState()).toMatchObject({ canUndo: false, canRedo: false });
  });

  it("allows Undo once an edit is committed", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("redzone");

    expect(play.editor.getViewState()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it("reverts the most recently committed edit first on Undo", () => {
    const play = openAfterTwoEdits();

    play.editor.undo();

    expect(play.session.fieldZone).toBe("middle");
    expect(playerIds(play)).toEqual(["a", "b", "player-1"]);
  });

  it("returns to the opened diagram and disables Undo once every edit is undone", () => {
    const play = openAfterTwoEdits();

    play.editor.undo();
    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState()).toMatchObject({ canUndo: false, canRedo: true });
  });

  it("redoes the undone edits in reverse order of undoing when Redo follows Undo", () => {
    const play = openAfterTwoEdits();
    const edited = play.session.getPlayData();
    play.editor.undo();
    play.editor.undo();

    play.editor.redo();
    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(edited);
  });

  it("disables Redo when another edit is committed after Undo", () => {
    const play = openAfterTwoEdits();
    play.editor.undo();

    play.click(yd(10, 0));
    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(false);
  });

  it("does not notify on Undo or Redo when there is nothing to revert or redo", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.undo();
    play.editor.redo();

    expect(play.notified).not.toHaveBeenCalled();
  });
});

describe("History at notification time", () => {
  it("exposes the post-commit canUndo inside the notification that commits a drag", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 2));
    const seen: boolean[] = [];
    play.notified.mockImplementation(() => seen.push(play.editor.getViewState().canUndo));

    play.editor.pointerUp(yd(12, 2));

    expect(seen).toEqual([true, true]);
  });

  it("exposes the post-Undo canRedo inside the notification of the Undo", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    const seen: boolean[] = [];
    play.notified.mockImplementation(() => seen.push(play.editor.getViewState().canRedo));

    play.editor.undo();

    expect(seen).toEqual([true, true]);
  });
});

describe("History during an operation in progress", () => {
  it("reverts the last committed edit when Undo runs during a drag", () => {
    const play = openDraggingAfterZoneSwitch();

    play.editor.undo();

    expect(play.session.fieldZone).toBe("middle");
  });

  it("does not move the player on release when Undo ran during the drag", () => {
    const play = openDraggingAfterZoneSwitch();

    play.editor.undo();
    play.editor.pointerUp(yd(12, 2));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("stops drawing when Redo runs while drawing", () => {
    const play = openDrawingWithRedo();

    play.editor.redo();

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("redoes the undone edit when Redo runs while drawing", () => {
    const play = openDrawingWithRedo();

    play.editor.redo();

    expect(play.session.fieldZone).toBe("redzone");
  });
});
