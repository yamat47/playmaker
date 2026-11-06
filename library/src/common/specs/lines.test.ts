import { describe, expect, it } from "vitest";
import { line, playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import { MAX_WAYPOINTS_PER_LINE } from "../model/line.js";
import type { PlayData } from "../model/play-data.js";
import { PLAYER_RADIUS_YARDS } from "../model/player.js";

function lineOf(data: Pick<PlayData, "lines">, id: string) {
  return data.lines.find((l) => l.id === id);
}

/** A diagram with line l selected. Its waypoint is (15, 2) and its end is (25, 5). */
function openWithLineSelected() {
  const play = openPlay(twoPlayersWithRoute());
  play.click(yd(25, 5));
  return play;
}

/**
 * A diagram with line l from a through (14, 2) and (18, 6) to (22, 10), and
 * line k from a through (8, -2) to (5, -5). Line l is selected.
 */
function openWithTwoLines() {
  const play = openPlay(
    playData(
      [player("a", 10, 0)],
      [
        { ...line("l"), waypoints: [yd(14, 2), yd(18, 6)], end: yd(22, 10) },
        { ...line("k"), waypoints: [yd(8, -2)], end: yd(5, -5) },
      ],
    ),
  );
  play.click(yd(22, 10));
  return play;
}

/**
 * Players a (10, 0) and b (20, 0), and line s from a straight to the center of b, selected. The
 * line is drawn up to the edge of b's marker, at (20 - PLAYER_RADIUS_YARDS, 0).
 */
function openWithLineEndingOnB() {
  const play = openPlay(
    playData([player("a", 10, 0), player("b", 20, 0)], [{ ...line("s"), end: yd(20, 0) }]),
  );
  play.click(yd(15, 0));
  return play;
}

/** A diagram where Undo removed a drawn and selected line. The selection still points at it. */
function openWithVanishedLine() {
  const play = openPlay(twoPlayersWithRoute());
  play.startLine(yd(20, 0));
  play.editor.pointerDown(yd(30, 8));
  play.editor.commitLine();
  play.editor.undo();
  return play;
}

describe("Dragging a waypoint", () => {
  it("moves the waypoint when a waypoint of the selected line is dragged", () => {
    const play = openWithLineSelected();

    play.drag(yd(15, 2), yd(16, 4));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(16, 4)]);
  });

  it("keeps the handle and the drawn line's waypoint on the pointer during the drag", () => {
    const play = openWithLineSelected();

    play.editor.pointerDown(yd(15, 2));
    play.editor.pointerMove(yd(16, 4));

    const { scene, overlay } = play.editor.getFrame();
    expect(overlay).toMatchObject({ waypointHandles: [yd(16, 4)] });
    expect(lineOf(scene, "l")?.waypoints).toEqual([yd(16, 4)]);
  });

  it("moves nothing but the grabbed waypoint in the drawn diagram during the drag", () => {
    const play = openWithTwoLines();

    play.editor.pointerDown(yd(14, 2));
    play.editor.pointerMove(yd(15, 3));

    const { scene } = play.editor.getFrame();
    expect(lineOf(scene, "l")?.waypoints).toEqual([yd(15, 3), yd(18, 6)]);
    expect(lineOf(scene, "k")?.waypoints).toEqual([yd(8, -2)]);
  });

  it("replaces only the grabbed waypoint on release", () => {
    const play = openWithTwoLines();

    play.drag(yd(14, 2), yd(15, 3));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(15, 3), yd(18, 6)]);
  });

  it("keeps the offset between the grab point and the pointer when grabbed off center", () => {
    const play = openWithLineSelected();

    play.drag(yd(15.5, 2.25), yd(18.5, 4.25));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(18, 4)]);
  });

  it("does not record history when released without moving", () => {
    const play = openWithLineSelected();

    play.click(yd(15, 2));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("records only the deletion when the line is deleted mid-drag and then released", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(15, 2));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(16, 4));
    play.editor.pointerUp(yd(16, 4));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("grabs the waypoint, not the player, when a waypoint over a player is pressed", () => {
    const play = openPlay(
      playData(
        [player("a", 10, 0), player("b", 20, 0)],
        [{ ...line("l"), waypoints: [yd(20, 0)], end: yd(25, 5) }],
      ),
    );
    play.click(yd(25, 5));

    play.drag(yd(20, 0), yd(20, 4));

    const data = play.session.getPlayData();
    expect(lineOf(data, "l")?.waypoints).toEqual([yd(20, 4)]);
    expect(data.players[1]?.position).toEqual(yd(20, 0));
  });

  it("selects the player underneath, not a handle, when pressed away from the handles", () => {
    const play = openWithLineSelected();

    play.click(yd(10, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });
});

describe("Dragging the end point", () => {
  it("ends the line at the player it is dropped on", () => {
    const play = openWithLineSelected();

    play.drag(yd(25, 5), yd(20, 0));

    expect(lineOf(play.session.getPlayData(), "l")?.end).toEqual(yd(20, 0));
  });

  it("puts the end handle where the line meets the marker of the player it ends on", () => {
    const play = openWithLineEndingOnB();

    expect(play.editor.getFrame().overlay).toMatchObject({
      endpointHandle: { lateralYard: expect.closeTo(20 - PLAYER_RADIUS_YARDS), downfieldYard: 0 },
    });
  });

  it("grabs the end, not the player, where the line meets the marker it ends on", () => {
    const play = openWithLineEndingOnB();

    play.drag(yd(19.2, 0), yd(19.2, 5));

    const data = play.session.getPlayData();
    expect(lineOf(data, "s")?.end).toEqual(yd(19, 5));
    expect(data.players[1]?.position).toEqual(yd(20, 0));
  });

  it("keeps the end on the player when its handle is pressed and released after a slight drift", () => {
    const play = openWithLineEndingOnB();

    play.drag(yd(19.1, 0), yd(19.2, 0.1));

    expect(play.session.getPlayData().lines[0]?.end).toEqual(yd(20, 0));
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("moves only the end when the end of the selected line is dragged", () => {
    const play = openWithLineSelected();

    play.drag(yd(25, 5), yd(28, 8));

    expect(lineOf(play.session.getPlayData(), "l")).toEqual({
      ...twoPlayersWithRoute().lines[0],
      end: yd(28, 8),
    });
  });

  it("keeps the handle and the drawn line's end on the pointer during the drag", () => {
    const play = openWithLineSelected();

    play.editor.pointerDown(yd(25, 5));
    play.editor.pointerMove(yd(28, 8));

    const { scene, overlay } = play.editor.getFrame();
    expect(overlay).toMatchObject({ endpointHandle: yd(28, 8) });
    expect(lineOf(scene, "l")?.end).toEqual(yd(28, 8));
  });

  it("does not move the ends of other lines in the drawn diagram during the drag", () => {
    const play = openWithTwoLines();

    play.editor.pointerDown(yd(22, 10));
    play.editor.pointerMove(yd(28, 12));

    expect(lineOf(play.editor.getFrame().scene, "k")?.end).toEqual(yd(5, -5));
  });

  it("keeps the offset between the grab point and the pointer when grabbed off center", () => {
    const play = openWithLineSelected();

    play.drag(yd(25.5, 5.25), yd(28.5, 8.25));

    expect(lineOf(play.session.getPlayData(), "l")?.end).toEqual(yd(28, 8));
  });

  it("snaps the end to the window edge when released outside the zone window", () => {
    const play = openWithLineSelected();

    play.drag(yd(25, 5), yd(25, 40));

    expect(lineOf(play.session.getPlayData(), "l")?.end).toEqual(yd(25, 15));
  });

  it("restores the original position when Undo follows moving the end", () => {
    const play = openWithLineSelected();
    play.drag(yd(25, 5), yd(28, 8));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not record history when released without moving", () => {
    const play = openWithLineSelected();

    play.click(yd(25, 5));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("leaves the line out of the drawn diagram when it is deleted mid-drag", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(25, 5));
    play.editor.deleteSelection();

    play.editor.pointerMove(yd(28, 8));

    expect(play.editor.getFrame().scene.lines).toEqual([]);
  });

  it("records only the deletion when the line is deleted mid-drag and then released", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(25, 5));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(28, 8));
    play.editor.pointerUp(yd(28, 8));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("grabs the end when the end and a waypoint overlap", () => {
    const play = openPlay(
      playData(
        [player("a", 10, 0)],
        [{ ...line("l"), waypoints: [yd(20, 10)], end: yd(20.2, 10) }],
      ),
    );
    play.click(yd(15, 5));

    play.drag(yd(20.2, 10), yd(30, 15));

    expect(lineOf(play.session.getPlayData(), "l")).toMatchObject({
      waypoints: [yd(20, 10)],
      end: yd(30, 15),
    });
  });
});

describe("Adding a bend", () => {
  it("adds a bend where the middle of a segment is dragged to", () => {
    const play = openWithLineSelected();

    play.drag(yd(20, 3.5), yd(20, 7));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(15, 2), yd(20, 7)]);
  });

  it("draws the new bend under the pointer while the middle of a segment is dragged", () => {
    const play = openWithLineSelected();

    play.editor.pointerDown(yd(12.5, 1));
    play.editor.pointerMove(yd(12, 4));

    expect(lineOf(play.editor.getFrame().scene, "l")?.waypoints).toEqual([yd(12, 4), yd(15, 2)]);
  });

  it("leaves the line as it is when the middle of a segment is only clicked", () => {
    const play = openWithLineSelected();

    play.click(yd(20, 3.5));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("leaves the line as it is when the middle of a segment is clicked with a slight drift", () => {
    const play = openWithLineSelected();

    play.drag(yd(20, 3.5), yd(20.1, 3.6));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("grabs a player rather than the middle of a segment that lies on it", () => {
    const play = openPlay(
      playData(
        [player("a", 10, 0), player("b", 20, 0)],
        [{ ...line("l"), waypoints: [], end: yd(30, 0) }],
      ),
    );
    play.click(yd(30, 0));

    play.drag(yd(20, 0), yd(20, 4));

    const data = play.session.getPlayData();
    expect(data.players[1]?.position).toEqual(yd(20, 4));
    expect(lineOf(data, "l")?.waypoints).toEqual([]);
  });

  it("offers no place for a bend once a line has MAX_WAYPOINTS_PER_LINE waypoints", () => {
    const full = Array.from({ length: MAX_WAYPOINTS_PER_LINE }, (_, i) => yd(11 + i * 0.5, 1));
    const play = openPlay(
      playData([player("a", 10, 0)], [{ ...line("l"), waypoints: full, end: yd(40, 10) }]),
    );

    play.click(yd(40, 10));

    expect(play.editor.getFrame().overlay).toMatchObject({ kind: "line", insertHandles: [] });
  });
});

describe("Removing a bend", () => {
  it("removes a bend that is double-clicked", () => {
    const play = openWithLineSelected();
    play.click(yd(15, 2));
    play.click(yd(15, 2));

    play.editor.doubleClick(yd(15, 2));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([]);
  });

  it("marks a pressed bend as picked", () => {
    const play = openWithLineSelected();

    play.click(yd(15, 2));

    expect(play.editor.getFrame().overlay).toMatchObject({ kind: "line", pickedWaypoint: 0 });
  });

  it("removes the picked bend with Delete and keeps the line selected", () => {
    const play = openWithLineSelected();
    play.click(yd(15, 2));

    play.editor.deleteSelection();

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([]);
    expect(play.editor.getViewState().selection).toEqual({ kind: "line", id: "l" });
  });

  it("lets go of the picked bend when another part of the line is pressed", () => {
    const play = openWithLineSelected();
    play.click(yd(15, 2));

    play.click(yd(25, 5));
    play.editor.deleteSelection();

    expect(lineOf(play.session.getPlayData(), "l")).toBeUndefined();
  });

  it("lets go of the picked bend on Undo, which may change the bends", () => {
    const play = openWithLineSelected();
    play.drag(yd(12.5, 1), yd(12, 4));
    play.click(yd(12, 4));

    play.editor.undo();

    expect(play.editor.getFrame().overlay).toMatchObject({
      kind: "line",
      waypointHandles: [yd(15, 2)],
      pickedWaypoint: undefined,
    });
  });

  it("lets go of the picked bend with Esc before clearing the selection", () => {
    const play = openWithLineSelected();
    play.click(yd(15, 2));

    play.editor.stepBack();

    expect(play.editor.getFrame().overlay).toMatchObject({
      kind: "line",
      pickedWaypoint: undefined,
    });
    expect(play.editor.getViewState().selection).toEqual({ kind: "line", id: "l" });
  });

  it("neither changes the diagram nor notifies on a double-click with nothing selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.doubleClick(yd(15, 2));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("neither changes the diagram nor notifies on a double-click away from the bends", () => {
    const play = openWithLineSelected();
    play.notified.mockClear();

    play.editor.doubleClick(yd(40, -10));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.notified).not.toHaveBeenCalled();
  });
});

describe("Deleting a line", () => {
  it("removes only that line when the selected line is deleted", () => {
    const play = openWithLineSelected();

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual({ ...twoPlayersWithRoute(), lines: [] });
  });

  it("clears the selection when the selected line is deleted", () => {
    const play = openWithLineSelected();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("restores the line in its original order when the deletion is undone", () => {
    const data = playData(
      [player("a", 10, 0)],
      [line("x"), { ...line("l"), end: yd(25, 5) }, line("y")],
    );
    const play = openPlay(data);
    play.click(yd(25, 5));
    play.editor.deleteSelection();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(data);
  });

  it("does not record history when deleting after the selected line vanished", () => {
    const play = openWithVanishedLine();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});

describe("Editing line values", () => {
  it("changes the kind, interpolation, and color of the selected line", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({ kind: "motion", interpolation: "bezier", color: "#ff0000" });

    expect(lineOf(play.session.getPlayData(), "l")).toEqual({
      ...twoPlayersWithRoute().lines[0],
      kind: "motion",
      interpolation: "bezier",
      color: "#ff0000",
    });
  });

  it("returns to a default line without color when the color receives null", () => {
    const play = openWithLineSelected();
    play.editor.updateSelectedLine({ color: "#ff0000" });

    play.editor.updateSelectedLine({ color: null });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("restores the previous values when Undo follows the change", () => {
    const play = openWithLineSelected();
    play.editor.updateSelectedLine({ kind: "block" });

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("applies the original values on Redo even if the passed patch is mutated later", () => {
    const play = openWithLineSelected();
    const patch: { kind: "block" | "motion" } = { kind: "block" };
    play.editor.updateSelectedLine(patch);
    patch.kind = "motion";
    play.editor.undo();

    play.editor.redo();

    expect(lineOf(play.session.getPlayData(), "l")?.kind).toBe("block");
  });

  it("does not change line values while a player is selected", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.editor.updateSelectedLine({ kind: "block" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not change line values while nothing is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.updateSelectedLine({ kind: "block" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not record history when changing values after the selected line vanished", () => {
    const play = openWithVanishedLine();

    play.editor.updateSelectedLine({ kind: "block" });

    expect(play.editor.getViewState().canRedo).toBe(true);
  });

  it("neither records history nor notifies when only the current values are passed", () => {
    const play = openWithLineSelected();
    play.notified.mockClear();

    play.editor.updateSelectedLine({ kind: "route", interpolation: "straight", color: null });

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("applies the values when at least one of them differs from the current one", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({ kind: "route", interpolation: "bezier" });

    expect(lineOf(play.session.getPlayData(), "l")?.interpolation).toBe("bezier");
  });

  it("notifies the view state when line values change even if the state is unchanged", () => {
    const play = openWithLineSelected();
    play.editor.updateSelectedLine({ kind: "block" });
    play.notified.mockClear();

    play.editor.updateSelectedLine({ kind: "motion" });

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("Selection of a vanished line", () => {
  it("shows no selection in the view state when Undo removes the selected line", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("returns no selected line when Undo removes the selected line", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getSelectedLine()).toBeUndefined();
  });

  it("draws no handles when Undo removes the selected line", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getFrame().overlay).toEqual({ kind: "none" });
  });

  it("moves nothing when dragging where the vanished line's end used to be", () => {
    const play = openWithVanishedLine();

    play.drag(yd(30, 8), yd(32, 10));

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});
