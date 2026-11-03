import { describe, expect, it } from "vitest";
import {
  line,
  playData,
  player,
  positionOf,
  twoPlayersWithRoute,
} from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("位置の格子", () => {
  it("読み込んだ選手の位置は、0.5yd の格子点へ寄せる", () => {
    const play = openPlay(playData([player("a", 26.7, -2.3)]));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(26.5, -2.5));
  });

  it("0 に寄る負の値は -0 ではなく 0 にする", () => {
    const play = openPlay(playData([player("a", -0.2, -0.1)]));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(0, 0));
  });

  it("読み込んだ線の waypoint と終点も、格子点へ寄せる", () => {
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

  it("選手の追加ツールでクリックすると、最も近い格子点に置く", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30.3, -4.7));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(30.5, -4.5));
  });

  it("選手をドラッグしている間も、格子点の上に描く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(14.3, 3.2));

    expect(positionOf(play.editor.getFrame().scene, "a")).toEqual(yd(14.5, 3));
  });

  it("同じ格子点に収まる距離だけ動かして離すと、履歴に積まず onChange も呼ばない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(10.1, 0.1));

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("中心から外れた点を掴んで離しても、ずれを保ったうえで格子点に置く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10.4, 0.4), yd(14.3, 3.2));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(14, 3));
  });

  it("作図中に押した点は、格子点に打つ", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));
    play.editor.pointerDown(yd(18.2, 9.8));

    play.editor.commitLine();

    expect(play.session.getPlayData().lines.at(-1)?.end).toEqual(yd(18, 10));
  });

  it("作図中のカーソルも、格子点の上に描く", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.editor.pointerMove(yd(18.2, 9.8));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(yd(18, 10));
  });
});
