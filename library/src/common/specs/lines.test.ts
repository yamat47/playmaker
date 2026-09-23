import { describe, expect, it } from "vitest";
import { line, playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import type { PlayData } from "../model/play-data.js";

function lineOf(data: Pick<PlayData, "lines">, id: string) {
  return data.lines.find((l) => l.id === id);
}

/** 線 l を選んだ図。waypoint は (15, 2)、終点は (25, 5)。 */
function openWithLineSelected() {
  const play = openPlay(twoPlayersWithRoute());
  play.click(yd(25, 5));
  return play;
}

/**
 * a から (14, 2) と (18, 6) を通って (22, 10) で終わる線 l と、
 * a から (8, -2) を通って (5, -5) で終わる線 k の図。l を選んである。
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

/** 作図で足して選んだ線を、Undo で消した図。選択はその線を指したまま残る。 */
function openWithVanishedLine() {
  const play = openPlay(twoPlayersWithRoute());
  play.editor.setTool("draw-line");
  play.editor.pointerDown(yd(20, 0));
  play.editor.pointerDown(yd(30, 8));
  play.editor.commitLine();
  play.editor.undo();
  return play;
}

describe("waypoint のドラッグ", () => {
  it("選んだ線の waypoint をドラッグすると、その waypoint を動かす", () => {
    const play = openWithLineSelected();

    play.drag(yd(15, 2), yd(16, 4));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(16, 4)]);
  });

  it("ドラッグ中は、ハンドルと描く線の waypoint がポインタに付いていく", () => {
    const play = openWithLineSelected();

    play.editor.pointerDown(yd(15, 2));
    play.editor.pointerMove(yd(16, 4));

    const { scene, overlay } = play.editor.getFrame();
    expect(overlay).toMatchObject({ waypointHandles: [yd(16, 4)] });
    expect(lineOf(scene, "l")?.waypoints).toEqual([yd(16, 4)]);
  });

  it("ドラッグ中は、掴んだ waypoint のほかは描く図の中で動かない", () => {
    const play = openWithTwoLines();

    play.editor.pointerDown(yd(14, 2));
    play.editor.pointerMove(yd(15, 3));

    const { scene } = play.editor.getFrame();
    expect(lineOf(scene, "l")?.waypoints).toEqual([yd(15, 3), yd(18, 6)]);
    expect(lineOf(scene, "k")?.waypoints).toEqual([yd(8, -2)]);
  });

  it("離すと、掴んだ waypoint だけを差し替える", () => {
    const play = openWithTwoLines();

    play.drag(yd(14, 2), yd(15, 3));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(15, 3), yd(18, 6)]);
  });

  it("中心から外れた点を掴んで動かすと、掴んだ点とポインタのずれを保って置く", () => {
    const play = openWithLineSelected();

    play.drag(yd(15.5, 2.25), yd(18.5, 4.25));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(18, 4)]);
  });

  it("動かさずに離すと、履歴に積まない", () => {
    const play = openWithLineSelected();

    play.click(yd(15, 2));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("ドラッグの途中で線を削除すると、離しても削除のほかに何も積まない", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(15, 2));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(16, 4));
    play.editor.pointerUp(yd(16, 4));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("選手の上にある waypoint を押すと、選手ではなく waypoint を掴む", () => {
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

  it("選んだ線のハンドルから外れた点を押すと、ハンドルを掴まずにその下の選手を選ぶ", () => {
    const play = openWithLineSelected();

    play.click(yd(10, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });
});

describe("終点のドラッグ", () => {
  it("選んだ線の終点をドラッグすると、終点だけを動かす", () => {
    const play = openWithLineSelected();

    play.drag(yd(25, 5), yd(28, 8));

    expect(lineOf(play.session.getPlayData(), "l")).toEqual({
      ...twoPlayersWithRoute().lines[0],
      end: yd(28, 8),
    });
  });

  it("ドラッグ中は、ハンドルと描く線の終点がポインタに付いていく", () => {
    const play = openWithLineSelected();

    play.editor.pointerDown(yd(25, 5));
    play.editor.pointerMove(yd(28, 8));

    const { scene, overlay } = play.editor.getFrame();
    expect(overlay).toMatchObject({ endpointHandle: yd(28, 8) });
    expect(lineOf(scene, "l")?.end).toEqual(yd(28, 8));
  });

  it("ドラッグ中は、ほかの線の終点は描く図の中で動かない", () => {
    const play = openWithTwoLines();

    play.editor.pointerDown(yd(22, 10));
    play.editor.pointerMove(yd(28, 12));

    expect(lineOf(play.editor.getFrame().scene, "k")?.end).toEqual(yd(5, -5));
  });

  it("中心から外れた点を掴んで動かすと、掴んだ点とポインタのずれを保って置く", () => {
    const play = openWithLineSelected();

    play.drag(yd(25.5, 5.25), yd(28.5, 8.25));

    expect(lineOf(play.session.getPlayData(), "l")?.end).toEqual(yd(28, 8));
  });

  it("ゾーンの窓の外で離すと、窓の端に寄せて置く", () => {
    const play = openWithLineSelected();

    play.drag(yd(25, 5), yd(25, 40));

    expect(lineOf(play.session.getPlayData(), "l")?.end).toEqual(yd(25, 15));
  });

  it("終点を動かしたあとに Undo すると、元の位置に戻る", () => {
    const play = openWithLineSelected();
    play.drag(yd(25, 5), yd(28, 8));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("動かさずに離すと、履歴に積まない", () => {
    const play = openWithLineSelected();

    play.click(yd(25, 5));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("ドラッグの途中で線を削除すると、描く図にもその線は出ない", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(25, 5));
    play.editor.deleteSelection();

    play.editor.pointerMove(yd(28, 8));

    expect(play.editor.getFrame().scene.lines).toEqual([]);
  });

  it("ドラッグの途中で線を削除すると、離しても削除のほかに何も積まない", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(25, 5));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(28, 8));
    play.editor.pointerUp(yd(28, 8));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("終点と waypoint が重なっていると、終点を掴む", () => {
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

describe("線の削除", () => {
  it("選んだ線を削除すると、その線だけが消える", () => {
    const play = openWithLineSelected();

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual({ ...twoPlayersWithRoute(), lines: [] });
  });

  it("選んだ線を削除すると、選択を外す", () => {
    const play = openWithLineSelected();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("削除を Undo すると、線が元の並びに戻る", () => {
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

  it("選んだ線が消えたあとに削除しても、履歴に積まない", () => {
    const play = openWithVanishedLine();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});

describe("線の値の編集", () => {
  it("選んでいる線の種別、補間、太さ、色を変える", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({
      kind: "motion",
      interpolation: "bezier",
      thickness: 2,
      color: "#ff0000",
    });

    expect(lineOf(play.session.getPlayData(), "l")).toEqual({
      ...twoPlayersWithRoute().lines[0],
      kind: "motion",
      interpolation: "bezier",
      thickness: 2,
      color: "#ff0000",
    });
  });

  it("色と太さに null を渡すと、どちらも持たない既定の線に戻る", () => {
    const play = openWithLineSelected();
    play.editor.updateSelectedLine({ color: "#ff0000", thickness: 2 });

    play.editor.updateSelectedLine({ color: null, thickness: null });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("変えたあとに Undo すると、変える前の値に戻る", () => {
    const play = openWithLineSelected();
    play.editor.updateSelectedLine({ kind: "block" });

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("渡したパッチをあとで書き換えても、Redo で当てる値は変わらない", () => {
    const play = openWithLineSelected();
    const patch: { kind: "block" | "motion" } = { kind: "block" };
    play.editor.updateSelectedLine(patch);
    patch.kind = "motion";
    play.editor.undo();

    play.editor.redo();

    expect(lineOf(play.session.getPlayData(), "l")?.kind).toBe("block");
  });

  it("選手を選んでいるときは、線の値を変えない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.editor.updateSelectedLine({ kind: "block" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("何も選んでいないときは、線の値を変えない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.updateSelectedLine({ kind: "block" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("選んだ線が消えたあとに値を変えても、履歴に積まない", () => {
    const play = openWithVanishedLine();

    play.editor.updateSelectedLine({ kind: "block" });

    expect(play.editor.getViewState().canRedo).toBe(true);
  });

  it("今と同じ値だけを渡すと、履歴に積まず通知もしない", () => {
    const play = openWithLineSelected();
    play.notified.mockClear();

    play.editor.updateSelectedLine({ kind: "route", interpolation: "straight", thickness: null });

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("渡した値のうち 1 つでも今と違えば、その値を当てる", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({ kind: "route", interpolation: "bezier" });

    expect(lineOf(play.session.getPlayData(), "l")?.interpolation).toBe("bezier");
  });

  it("表示状態が変わらなくても、選んでいる線の値が変われば表示状態を通知する", () => {
    const play = openWithLineSelected();
    play.editor.updateSelectedLine({ kind: "block" });
    play.notified.mockClear();

    play.editor.updateSelectedLine({ kind: "motion" });

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("消えた線の選択", () => {
  it("選んだ線が Undo で消えると、表示状態は無選択になる", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("選んだ線が Undo で消えると、選択中の線を返さない", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getSelectedLine()).toBeUndefined();
  });

  it("選んだ線が Undo で消えると、ハンドルを描かない", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getFrame().overlay).toEqual({ kind: "none" });
  });

  it("選んだ線が消えたあとに、その終点があった位置をドラッグしても、何も動かさない", () => {
    const play = openWithVanishedLine();

    play.drag(yd(30, 8), yd(32, 10));

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});
