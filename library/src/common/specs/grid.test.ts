import { describe, expect, it } from "vitest";
import {
  line,
  playData,
  player,
  positionOf,
  twoPlayersWithRoute,
} from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("Position grid", () => {
  it("snaps a loaded player position to a 0.5yd grid point", () => {
    const play = openPlay(playData([player("a", 26.7, -2.3)]));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(26.5, -2.5));
  });

  it("turns a negative value that snaps to 0 into 0, not -0", () => {
    const play = openPlay(playData([player("a", -0.2, -0.1)]));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(0, 0));
  });

  it("snaps the waypoints and end of a loaded line to grid points", () => {
    const offGrid = {
      ...line("l"),
      waypoints: [yd(12.2, 3.1)],
      end: yd(20.9, 7.8),
    };
    const play = openPlay(playData([player("a", 10, 0)], [offGrid]));

    expect(play.session.getPlayData().lines[0]).toMatchObject({
      waypoints: [yd(12, 3)],
      end: yd(21, 8),
    });
  });

  it("places a player on the nearest grid point when clicked with the add-player tool", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30.3, -4.7));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(30.5, -4.5));
  });

  it("draws a player on grid points while it is being dragged", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(14.3, 3.2));

    expect(positionOf(play.editor.getFrame().scene, "a")).toEqual(yd(14.5, 3));
  });

  it("skips history and onChange when a drag ends on the same grid point", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(10.1, 0.1));

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("places a player grabbed off center on a grid point while keeping the grab offset", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10.4, 0.4), yd(14.3, 3.2));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(14, 3));
  });

  it("places a point pressed during drawing on a grid point", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));
    play.editor.pointerDown(yd(18.2, 9.8));

    play.editor.commitLine();

    expect(play.session.getPlayData().lines.at(-1)?.end).toEqual(yd(18, 10));
  });

  it("draws the cursor end of the line on a grid point while drawing", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.editor.pointerMove(yd(18.2, 9.8));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(yd(18, 10));
  });
});
