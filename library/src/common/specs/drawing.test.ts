import { describe, expect, it } from "vitest";
import { line, playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, type PlayDriver, yd } from "../../test-support/play-driver.js";
import { type Line, MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "../model/line.js";

function startDrawingFromA(play: PlayDriver): PlayDriver {
  play.editor.setTool("draw-line");
  play.editor.pointerDown(yd(10, 0));
  return play;
}

/** 作図ツールで選手 a から描き始めた図。 */
function openDrawingFromA(): PlayDriver {
  return startDrawingFromA(openPlay(twoPlayersWithRoute()));
}

/** 選手 a を選んだまま作図ツールへ切り替え、a から描き始めた図。 */
function openDrawingFromSelectedA(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.click(yd(10, 0));
  return startDrawingFromA(play);
}

/** 選手 a と、線を MAX_LINES 本持つ図。 */
function openWithMaxLines(): PlayDriver {
  const lines = Array.from({ length: MAX_LINES }, (_, i) => line(`m-${i}`));
  return openPlay(playData([player("a", 10, 0)], lines));
}

/** 図の線のうち、作図で足した線。 */
function addedLine(play: PlayDriver): Line | undefined {
  return play.session.getPlayData().lines.find((l) => l.id !== "l");
}

describe("作図の開始", () => {
  it("作図ツールで空白を押しても、作図を始めず通知もしない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("draw-line");
    play.notified.mockClear();

    play.editor.pointerDown(yd(40, -10));

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("作図ツールで選手を押すと、作図を始める", () => {
    const play = openDrawingFromA();

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });

  it("作図を始めると、起点の選手からカーソルまでの線を描く", () => {
    const play = openDrawingFromA();

    play.editor.pointerMove(yd(12, 8));

    expect(play.editor.getFrame().scene.lines.at(-1)).toMatchObject({
      startPlayerId: "a",
      waypoints: [],
      end: yd(12, 8),
    });
  });

  it("線が MAX_LINES 本あると、選手を押しても作図を始めない", () => {
    const play = openWithMaxLines();
    play.editor.setTool("draw-line");

    play.editor.pointerDown(yd(10, 0));

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("線が MAX_LINES 本あると、線を描き始められないと表示状態で知らせる", () => {
    const play = openWithMaxLines();

    expect(play.editor.getViewState().canStartLine).toBe(false);
  });
});

describe("打点", () => {
  it("作図中に押した点は、描く線の waypoint になる", () => {
    const play = openDrawingFromA();

    play.editor.pointerDown(yd(12, 8));

    expect(play.editor.getFrame().scene.lines.at(-1)?.waypoints).toEqual([yd(12, 8)]);
  });

  it("作図中に離しても、作図を続ける", () => {
    const play = openDrawingFromA();

    play.editor.pointerUp(yd(10, 0));

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });

  it("直前に打った点のすぐ近くを押しても、点を打たない", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.editor.pointerDown(yd(18.1, 10));

    play.editor.commitLine();

    expect(addedLine(play)).toMatchObject({ waypoints: [], end: yd(18, 10) });
  });

  it("窓の外へ動かすと、描く線の終点は窓の端で止まる", () => {
    const play = openDrawingFromA();

    play.editor.pointerMove(yd(99, 0));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(yd(160 / 3, 0));
  });

  it("窓の外を押すと、窓の端に点を打つ", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(10, 49));

    play.editor.commitLine();

    expect(addedLine(play)?.end).toEqual(yd(10, 15));
  });

  it("waypoint の上限を超えて打った点は、確定する線に入らない", () => {
    const play = openDrawingFromA();
    for (let i = 1; i <= MAX_WAYPOINTS_PER_LINE + 2; i++) {
      play.editor.pointerDown(yd(10 + i, 3));
    }

    play.editor.commitLine();

    expect(addedLine(play)?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(addedLine(play)?.end).toEqual(yd(11 + MAX_WAYPOINTS_PER_LINE, 3));
  });

  it("打てる点が尽きると、描く線はカーソルではなく最後に打った点で終わる", () => {
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

describe("線の確定", () => {
  it("確定すると、最後に打った点を終点、手前の点を waypoint にした線を足す", () => {
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

  it("確定すると、足した線を選ぶ", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(play.editor.getViewState().selection).toEqual({ kind: "line", id: "line-1" });
  });

  it("確定すると、選択ツールに戻る", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(play.editor.getViewState().tool).toBe("select");
  });

  it("確定すると、描く図と表示状態の通知を 1 回ずつ出す", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.notified.mockClear();

    play.editor.commitLine();

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("確定したあとに Undo すると、足した線が消える", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.editor.commitLine();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("点を打たずに確定すると、線を足さずに作図をやめる", () => {
    const play = openDrawingFromA();

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("起点の選手の上でダブルクリックして確定しても、線を足さない", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerDown(yd(10, 0));

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("起点の選手が打った点の上へ動いて全長が 0 に近くなると、確定しても線を足さない", () => {
    const play = openDrawingFromSelectedA();
    play.editor.pointerDown(yd(14, 0));
    play.editor.updateSelectedPlayer({ position: yd(14, 0) });

    play.editor.commitLine();

    expect(play.session.getPlayData().lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("作図中に起点の選手を消すと、確定しても線を足さない", () => {
    const play = openDrawingFromSelectedA();
    play.editor.pointerDown(yd(14, 8));
    play.editor.deleteSelection();

    play.editor.commitLine();

    expect(play.session.getPlayData().lines).toEqual([]);
  });

  it("作図していないときに確定しても、図を変えず通知もしない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.notified).not.toHaveBeenCalled();
  });
});

describe("作図の取り消し", () => {
  it("作図中に Undo すると、最後に打った点だけを取り消す", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(14, 0));
    play.editor.pointerDown(yd(18, 0));

    play.editor.undo();
    play.editor.commitLine();

    expect(addedLine(play)).toMatchObject({ waypoints: [], end: yd(14, 0) });
  });

  it("作図中に Undo しても、確定した編集は戻さない", () => {
    const play = openDrawingFromSelectedA();
    play.editor.updateSelectedPlayer({ label: "QB" });
    play.editor.pointerDown(yd(14, 0));

    play.editor.undo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("点を打つ前に Undo すると、作図をやめる", () => {
    const play = openDrawingFromA();

    play.editor.undo();

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("点を打つ前に Undo しても、確定した編集は戻さない", () => {
    const play = openDrawingFromSelectedA();
    play.editor.updateSelectedPlayer({ label: "QB" });

    play.editor.undo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("作図を取り消すと、作図をやめて描く図と表示状態を通知する", () => {
    const play = openDrawingFromA();
    play.notified.mockClear();

    play.editor.cancelInteraction();

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("作図していないときに取り消しても、通知しない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.cancelInteraction();

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("別のツールに切り替えると、作図をやめる", () => {
    const play = openDrawingFromA();

    play.editor.setTool("select");

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });
});
