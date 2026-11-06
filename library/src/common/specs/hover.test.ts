import { describe, expect, it } from "vitest";
import {
  line,
  manyPlayers,
  playData,
  player,
  twoPlayersWithRoute,
} from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import { MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "../model/line.js";
import { MAX_PLAYERS } from "../model/player.js";

describe("Pointer hover", () => {
  it("marks the player under the pointer and shows that it can be grabbed", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerMove(yd(10, 0));

    expect(play.editor.getFrame()).toMatchObject({
      hover: { kind: "player", id: "a" },
      cursor: "grab",
    });
  });

  it("marks the line under the pointer and shows that it can be selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerMove(yd(20, 3.5));

    expect(play.editor.getFrame()).toMatchObject({
      hover: { kind: "line", id: "l" },
      cursor: "pointer",
    });
  });

  it("shows the plain cursor over empty space with the select tool", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerMove(yd(40, -10));

    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "none" }, cursor: "default" });
  });

  it("shows a crosshair over a player with a line tool, where a press starts a line", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("block");

    play.editor.pointerMove(yd(20, 0));

    expect(play.editor.getFrame().cursor).toBe("crosshair");
  });

  it("marks no player and shows that no line can start once MAX_LINES lines exist", () => {
    const lines = Array.from({ length: MAX_LINES }, (_, i) => line(`m-${i}`));
    const play = openPlay(playData([player("a", 10, 0)], lines));
    play.editor.setTool("route");

    play.editor.pointerMove(yd(10, 0));

    expect(play.editor.getFrame()).toMatchObject({
      hover: { kind: "none" },
      cursor: "not-allowed",
    });
  });

  it("shows a crosshair over empty space with the add-player tool", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");

    play.editor.pointerMove(yd(40, -10));

    expect(play.editor.getFrame().cursor).toBe("crosshair");
  });

  it("shows that no player can be placed once MAX_PLAYERS players exist", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS)));
    play.editor.setTool("add-player");

    play.editor.pointerMove(yd(40, 10));

    expect(play.editor.getFrame().cursor).toBe("not-allowed");
  });

  it("shows a grab cursor over a handle of the selected line without marking anything", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(25, 5));

    play.editor.pointerMove(yd(15, 2));

    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "none" }, cursor: "grab" });
  });

  it("clears the mark when the pointer leaves the field", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerMove(yd(10, 0));

    play.editor.pointerLeave();

    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "none" }, cursor: "default" });
  });

  it("does not redraw when the pointer leaves the field over nothing", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerMove(yd(40, -10));
    play.notified.mockClear();

    play.editor.pointerLeave();

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("marks a player rather than the middle of a selected line that lies on it", () => {
    const play = openPlay(
      playData(
        [player("a", 10, 0), player("b", 20, 0)],
        [{ ...line("l"), waypoints: [], end: yd(30, 0) }],
      ),
    );
    play.click(yd(30, 0));

    play.editor.pointerMove(yd(20, 0));

    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "player", id: "b" } });
  });

  it("redraws when a release lands away from where the pointer last moved", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerMove(yd(10, 0));
    play.notified.mockClear();

    play.editor.pointerUp(yd(40, -10));

    expect(play.notified).toHaveBeenCalledOnce();
    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "none" }, cursor: "default" });
  });

  it("follows a deletion under the resting pointer without a move", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(20, 3.5));

    play.editor.deleteSelection();

    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "none" }, cursor: "default" });
  });

  it("redraws with the cursor of a tool chosen while the pointer rests", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerMove(yd(10, 0));
    play.notified.mockClear();

    play.editor.setTool("route");

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
    expect(play.editor.getFrame().cursor).toBe("crosshair");
  });

  it("redraws only when what is under the pointer changes", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerMove(yd(10, 0));
    play.notified.mockClear();

    play.editor.pointerMove(yd(10.5, 0.5));
    play.editor.pointerMove(yd(20, 0));

    expect(play.notified.mock.calls).toEqual([["scene"]]);
  });

  it("does not redraw while the pointer moves along the same line", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerMove(yd(20, 3.5));
    play.notified.mockClear();

    play.editor.pointerMove(yd(21, 3.8));

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("shows a grabbing cursor and no mark while a player is dragged", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 1));

    expect(play.editor.getFrame()).toMatchObject({ hover: { kind: "none" }, cursor: "grabbing" });
  });

  it("shows a crosshair while a line is drawn", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.startLine(yd(10, 0));

    expect(play.editor.getFrame().cursor).toBe("crosshair");
  });

  it("shows that no point can be placed once the line being drawn holds all it can", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    for (let i = 1; i <= MAX_WAYPOINTS_PER_LINE + 1; i++) {
      play.editor.pointerDown(yd(10 + i, 3));
    }

    expect(play.editor.getFrame().cursor).toBe("not-allowed");
  });
});
