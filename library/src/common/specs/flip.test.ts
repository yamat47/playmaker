import { describe, expect, it } from "vitest";
import { playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("Flipping the play", () => {
  it("mirrors every player and line across the middle of the field", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.flip();

    const { players, lines } = play.session.getPlayData();
    expect(players.map((p) => p.position)).toEqual([yd(43, 0), yd(33, 0)]);
    expect(lines[0]).toMatchObject({ waypoints: [yd(38, 2)], end: yd(28, 5) });
  });

  it("keeps the labels where they were, on the players that moved", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.flip();

    expect(play.session.getPlayData().players.map((p) => p.label)).toEqual(["a", "b"]);
  });

  it("keeps the selection on the flipped player", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.editor.flip();

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });

  it("passes the flipped diagram exactly once", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.flip();

    expect(play.onChange).toHaveBeenCalledExactlyOnceWith(play.session.getPlayData());
  });

  it("puts the diagram back with one Undo", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.flip();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("commits a label still being typed before flipping", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.editor.previewLabel("QB");

    play.editor.flip();

    expect(play.session.getPlayData().players[0]).toMatchObject({
      label: "QB",
      position: yd(43, 0),
    });
  });

  it("records nothing for a diagram lying on the center line", () => {
    const play = openPlay(playData([player("c", 26.5, -5)]));

    play.editor.flip();

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.onChange).not.toHaveBeenCalled();
  });
});
