import { describe, expect, it } from "vitest";
import { line, playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, type PlayDriver, yd } from "../../test-support/play-driver.js";
import { FIELD_WIDTH_YARDS } from "../geometry/field.js";
import { type Line, MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "../model/line.js";

function startDrawingFromA(play: PlayDriver): PlayDriver {
  play.startLine(yd(10, 0));
  return play;
}

/** A diagram where drawing started from player a with the draw-line tool. */
function openDrawingFromA(): PlayDriver {
  return startDrawingFromA(openPlay(twoPlayersWithRoute()));
}

/** A diagram where player a was selected, then drawing started from a with the draw-line tool. */
function openDrawingFromSelectedA(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.click(yd(10, 0));
  return startDrawingFromA(play);
}

/** A diagram with player a and MAX_LINES lines. */
function openWithMaxLines(): PlayDriver {
  const lines = Array.from({ length: MAX_LINES }, (_, i) => line(`m-${i}`));
  return openPlay(playData([player("a", 10, 0)], lines));
}

/** The line that drawing added to the diagram. */
function addedLine(play: PlayDriver): Line | undefined {
  return play.session.getPlayData().lines.find((l) => l.id !== "l");
}

describe("Starting a drawing", () => {
  it("neither starts drawing nor notifies when the draw-line tool presses empty space", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("draw-line");
    play.notified.mockClear();

    play.editor.pointerDown(yd(40, -10));

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("starts drawing when a player is pressed with the draw-line tool", () => {
    const play = openDrawingFromA();

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });

  it("draws a line from the start player to the cursor once drawing starts", () => {
    const play = openDrawingFromA();

    play.editor.pointerMove(yd(12, 8));

    expect(play.editor.getFrame().scene.lines.at(-1)).toMatchObject({
      startPlayerId: "a",
      waypoints: [],
      end: yd(12, 8),
    });
  });

  it("does not start drawing when a player is pressed with MAX_LINES lines present", () => {
    const play = openWithMaxLines();
    play.editor.setTool("draw-line");

    play.editor.pointerDown(yd(10, 0));

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("reports in the view state that no line can be started when MAX_LINES lines exist", () => {
    const play = openWithMaxLines();

    expect(play.editor.getViewState().canStartLine).toBe(false);
  });
});

describe("Placing points", () => {
  it("turns a point pressed while drawing into a waypoint of the drawn line", () => {
    const play = openDrawingFromA();

    play.editor.pointerDown(yd(12, 8));

    expect(play.editor.getFrame().scene.lines.at(-1)?.waypoints).toEqual([yd(12, 8)]);
  });

  it("keeps drawing when the pointer is released while drawing", () => {
    const play = openDrawingFromA();

    play.editor.pointerUp(yd(10, 0));

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });

  it("does not place a point when the same grid point as the last one is pressed", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.editor.pointerDown(yd(18.1, 10));

    play.editor.commitLine();

    expect(addedLine(play)).toMatchObject({ waypoints: [], end: yd(18, 10) });
  });

  it("places a point when the grid point next to the last one is pressed", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.editor.pointerDown(yd(18.5, 10));

    play.editor.commitLine();

    expect(addedLine(play)).toMatchObject({ waypoints: [yd(18, 10)], end: yd(18.5, 10) });
  });

  it("stops the end of the drawn line at the window edge when moved outside the window", () => {
    const play = openDrawingFromA();

    play.editor.pointerMove(yd(99, 0));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(yd(FIELD_WIDTH_YARDS, 0));
  });

  it("places a point at the window edge when pressed outside the window", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(10, 49));

    play.editor.commitLine();

    expect(addedLine(play)?.end).toEqual(yd(10, 15));
  });

  it("leaves points placed beyond the waypoint limit out of the committed line", () => {
    const play = openDrawingFromA();
    for (let i = 1; i <= MAX_WAYPOINTS_PER_LINE + 2; i++) {
      play.editor.pointerDown(yd(10 + i, 3));
    }

    play.editor.commitLine();

    expect(addedLine(play)?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(addedLine(play)?.end).toEqual(yd(11 + MAX_WAYPOINTS_PER_LINE, 3));
  });

  it("ends the drawn line at the last point rather than the cursor when no points remain", () => {
    const play = openDrawingFromA();
    for (let i = 1; i <= MAX_WAYPOINTS_PER_LINE + 1; i++) {
      play.editor.pointerDown(yd(10 + i, 3));
    }

    play.editor.pointerMove(yd(50, 10));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(
      yd(11 + MAX_WAYPOINTS_PER_LINE, 3),
    );
  });
});

describe("Committing a line", () => {
  it("adds a line ending at the last point with the earlier points as waypoints on commit", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(12, 5));
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(addedLine(play)).toEqual({
      id: "line-1",
      kind: "route",
      startPlayerId: "a",
      waypoints: [yd(12, 5)],
      end: yd(18, 10),
      interpolation: "straight",
    });
  });

  it("selects the added line on commit", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(play.editor.getViewState().selection).toEqual({ kind: "line", id: "line-1" });
  });

  it("returns to the select tool on commit", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(play.editor.getViewState().tool).toBe("select");
  });

  it("notifies the scene and the view state once each on commit", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.notified.mockClear();

    play.editor.commitLine();

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("removes the added line when Undo follows the commit", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.editor.commitLine();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("stops drawing without adding a line when committed before any point is placed", () => {
    const play = openDrawingFromA();

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("does not add a line when committed after a double click on the start player", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerDown(yd(10, 0));

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not add a near-zero line when the start player moved onto the placed point", () => {
    const play = openDrawingFromSelectedA();
    play.editor.pointerDown(yd(14, 0));
    play.editor.updateSelectedPlayer({ position: yd(14, 0) });

    play.editor.commitLine();

    expect(play.session.getPlayData().lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("does not add a line on commit when the start player was deleted while drawing", () => {
    const play = openDrawingFromSelectedA();
    play.editor.pointerDown(yd(14, 8));
    play.editor.deleteSelection();

    play.editor.commitLine();

    expect(play.session.getPlayData().lines).toEqual([]);
  });

  it("neither changes the diagram nor notifies when committed while not drawing", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.notified).not.toHaveBeenCalled();
  });
});

describe("Canceling a drawing", () => {
  it("cancels only the last placed point when Undo runs while drawing", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(14, 0));
    play.editor.pointerDown(yd(18, 0));

    play.editor.undo();
    play.editor.commitLine();

    expect(addedLine(play)).toMatchObject({ waypoints: [], end: yd(14, 0) });
  });

  it("does not revert committed edits when Undo runs while drawing", () => {
    const play = openDrawingFromSelectedA();
    play.editor.updateSelectedPlayer({ label: "QB" });
    play.editor.pointerDown(yd(14, 0));

    play.editor.undo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("stops drawing when Undo runs before any point is placed", () => {
    const play = openDrawingFromA();

    play.editor.undo();

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("does not revert committed edits when Undo runs before any point is placed", () => {
    const play = openDrawingFromSelectedA();
    play.editor.updateSelectedPlayer({ label: "QB" });

    play.editor.undo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("stops drawing and notifies the scene and the view state on cancel", () => {
    const play = openDrawingFromA();
    play.notified.mockClear();

    play.editor.cancelInteraction();

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("does not notify when canceled while not drawing", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.cancelInteraction();

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("stops drawing when another tool is selected", () => {
    const play = openDrawingFromA();

    play.editor.setTool("select");

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });
});
