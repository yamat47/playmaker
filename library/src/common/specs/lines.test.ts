import { describe, expect, it } from "vitest";
import { line, playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import { MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "../model/line.js";
import type { PlayData } from "../model/play-data.js";

/** 選手 a から作図を始めた図。 */
function openDrawingFromA() {
  const play = openPlay(twoPlayersWithRoute());
  play.editor.setTool("draw-line");
  play.editor.pointerDown(yd(10, 0));
  return play;
}

/** 線 l を選んだ図。l は (15, 2) を通って (25, 5) で終わる。 */
function openWithLineSelected(data: PlayData = twoPlayersWithRoute()) {
  const play = openPlay(data);
  play.click(yd(25, 5));
  return play;
}

/** 線を描いて選んだあと、Undo でその線を消した状態。選択はその線を指したまま残る。 */
function openWithVanishedLine() {
  const play = openDrawingFromA();
  play.editor.pointerDown(yd(18, 10));
  play.editor.commitLine();
  play.editor.undo();
  return play;
}

function lineOf(data: Pick<PlayData, "lines">, id: string) {
  return data.lines.find((l) => l.id === id);
}

/** 選手 b から出る線が MAX_LINES 本ある図。 */
function fullOfLines(): PlayData {
  const lines = Array.from({ length: MAX_LINES }, (_, i) => line(`m-${i}`, "b"));
  return { ...twoPlayersWithRoute(), lines };
}

/** 作図中に、右へ 1 ヤードずつずらして count 個の点を打つ。 */
function tapPoints(play: ReturnType<typeof openDrawingFromA>, count: number): void {
  for (let i = 1; i <= count; i++) {
    play.editor.pointerDown(yd(10 + i, 3));
  }
}

/** 選手 a から出る 3 本の線 l1、l2、l3 の図。 */
function threeLines(): PlayData {
  return playData(
    [player("a", 10, 0)],
    [
      { ...line("l1"), waypoints: [yd(14, 2), yd(18, 6)], end: yd(22, 10) },
      { ...line("l2"), end: yd(5, -5) },
      { ...line("l3"), end: yd(30, 10) },
    ],
  );
}

describe("線の作図", () => {
  it("選手を押すと、作図を始める", () => {
    const play = openDrawingFromA();

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });

  it("作図を始めると、選手から選手自身の位置まで伸びる線を描く", () => {
    const play = openDrawingFromA();

    expect(play.editor.getFrame().scene.lines.at(-1)).toMatchObject({
      startPlayerId: "a",
      waypoints: [],
      end: yd(10, 0),
    });
  });

  it("選手の無い場所を押しても、作図を始めず通知もしない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("draw-line");
    play.notified.mockClear();

    play.editor.pointerDown(yd(40, -10));

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("作図中にポインタを動かすと、描く線の終点がポインタに付いてくる", () => {
    const play = openDrawingFromA();

    play.editor.pointerMove(yd(12, 8));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(yd(12, 8));
  });

  it("作図中に押した点は、描く線の waypoint になる", () => {
    const play = openDrawingFromA();

    play.editor.pointerDown(yd(12, 8));

    expect(play.editor.getFrame().scene.lines.at(-1)?.waypoints).toEqual([yd(12, 8)]);
  });

  it("作図中に離しても、作図は続く", () => {
    const play = openDrawingFromA();

    play.editor.pointerUp(yd(10, 0));

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });

  it("確定すると、最後の点を終点、手前の点を waypoint にした直線のルートを足す", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(12, 5));
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(play.session.getPlayData().lines.at(-1)).toEqual({
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

  it("確定すると、作図をやめて選択ツールへ戻る", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));

    play.editor.commitLine();

    expect(play.editor.getViewState()).toMatchObject({ tool: "select", isDrawing: false });
  });

  it("確定で図、履歴、ツール、選択が変わっても、通知は描く図と表示状態の 1 回ずつにまとめる", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.notified.mockClear();

    play.editor.commitLine();

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("直前の点のすぐ近くを押しても、点を打たない", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));

    play.editor.pointerDown(yd(18.1, 10));
    play.editor.commitLine();

    expect(play.session.getPlayData().lines.at(-1)).toMatchObject({
      waypoints: [],
      end: yd(18, 10),
    });
  });

  it("点を打たずに確定すると、線を足さない", () => {
    const play = openDrawingFromA();

    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("点を打たずに確定すると、作図をやめる", () => {
    const play = openDrawingFromA();

    play.editor.commitLine();

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("確定した線を Undo して Redo すると、同じ線が戻る", () => {
    const play = openDrawingFromA();
    play.editor.pointerDown(yd(18, 10));
    play.editor.commitLine();
    const committed = play.session.getPlayData();
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(committed);
  });

  it("作図を始めた選手の上でダブルクリックしても、線を確定しない", () => {
    const play = openDrawingFromA();

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerDown(yd(10, 0));
    play.editor.commitLine();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("起点の選手が打った点の上へ動いて長さがほぼ 0 になった線は、確定しない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.editor.setTool("draw-line");
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerDown(yd(14, 0));
    play.editor.updateSelectedPlayer({ position: yd(14, 0) });

    play.editor.commitLine();

    expect(play.session.getPlayData().lines.map((l) => l.id)).toEqual(["l"]);
  });

  it("作図の途中で起点の選手を削除すると、確定しても線を足さない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(20, 0));
    play.editor.setTool("draw-line");
    play.editor.pointerDown(yd(20, 0));
    play.editor.pointerDown(yd(22, 8));
    play.editor.deleteSelection();

    play.editor.commitLine();

    expect(play.session.getPlayData().lines.map((l) => l.id)).toEqual(["l"]);
  });

  it("作図していないときに確定しても、通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.commitLine();

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("選手をドラッグしている途中に確定しても、ドラッグは続く", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));

    play.editor.commitLine();
    play.editor.pointerUp(yd(12, 3));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(12, 3));
  });

  it("作図を取り消すと、作図をやめて描く図と表示状態を通知する", () => {
    const play = openDrawingFromA();
    play.notified.mockClear();

    play.editor.cancelInteraction();

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("途中の操作が無いときに取り消しても、通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.cancelInteraction();

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("別のツールへ切り替えると、作図をやめて描く図と表示状態を通知する", () => {
    const play = openDrawingFromA();
    play.notified.mockClear();

    play.editor.setTool("select");

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("作図中の Undo は最後に打った点だけを取り消し、履歴には触れない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    play.editor.setTool("draw-line");
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerDown(yd(14, 0));
    play.editor.pointerDown(yd(18, 0));

    play.editor.undo();
    play.editor.commitLine();

    expect(play.session.getPlayData().lines.at(-1)).toMatchObject({
      waypoints: [],
      end: yd(14, 0),
    });
    expect(play.session.fieldZone).toBe("redzone");
  });

  it("打った点が無いときの作図中の Undo は、作図をやめて履歴には触れない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    play.editor.setTool("draw-line");
    play.editor.pointerDown(yd(10, 0));

    play.editor.undo();

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.session.fieldZone).toBe("redzone");
  });

  it("作図中の Redo は、作図をやめてから履歴を進める", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    play.editor.undo();
    play.editor.setTool("draw-line");
    play.editor.pointerDown(yd(10, 0));

    play.editor.redo();

    expect(play.editor.getViewState().isDrawing).toBe(false);
    expect(play.session.fieldZone).toBe("redzone");
  });

  it("ゾーンの窓の外へポインタを動かすと、描く線の終点は窓の端で止まる", () => {
    const play = openDrawingFromA();

    play.editor.pointerMove(yd(99, 0));

    expect(play.editor.getFrame().scene.lines.at(-1)?.end).toEqual(yd(160 / 3, 0));
  });

  it("ゾーンの窓の外に打った点は、窓の端に寄せて確定する", () => {
    const play = openDrawingFromA();

    play.editor.pointerDown(yd(10, 49));
    play.editor.commitLine();

    expect(play.session.getPlayData().lines.at(-1)?.end).toEqual(yd(10, 15));
  });

  it("線が MAX_LINES 本あると、選手を押しても作図を始めない", () => {
    const play = openPlay(fullOfLines());
    play.editor.setTool("draw-line");

    play.editor.pointerDown(yd(10, 0));

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("線が MAX_LINES 本あると、表示状態は線を描き始められないと返す", () => {
    const play = openPlay(fullOfLines());

    expect(play.editor.getViewState().canStartLine).toBe(false);
  });

  it("waypoint の上限を超えて打った点は、確定した線に入らない", () => {
    const play = openDrawingFromA();
    tapPoints(play, MAX_WAYPOINTS_PER_LINE + 2);

    play.editor.commitLine();

    const added = play.session.getPlayData().lines.at(-1);
    expect(added?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(added?.end).toEqual(yd(10 + MAX_WAYPOINTS_PER_LINE + 1, 3));
  });

  it("打った点が上限に達したら、描く線はポインタではなく最後に打った点を終点にする", () => {
    const play = openDrawingFromA();
    tapPoints(play, MAX_WAYPOINTS_PER_LINE + 1);

    play.editor.pointerMove(yd(50, 10));

    const draft = play.editor.getFrame().scene.lines.at(-1);
    expect(draft?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
    expect(draft?.end).toEqual(yd(10 + MAX_WAYPOINTS_PER_LINE + 1, 3));
  });
});

describe("waypoint と終点のドラッグ", () => {
  it("waypoint のドラッグ中は、その waypoint のハンドルと描く線だけが動く", () => {
    const play = openPlay(threeLines());
    play.click(yd(22, 10));

    play.editor.pointerDown(yd(14, 2));
    play.editor.pointerMove(yd(15, 3));

    const { scene, overlay } = play.editor.getFrame();
    expect(overlay).toMatchObject({ waypointHandles: [yd(15, 3), yd(18, 6)] });
    expect(scene.lines.map((l) => l.waypoints)).toEqual([[yd(15, 3), yd(18, 6)], [], []]);
  });

  it("waypoint をドラッグして離すと、掴んだ waypoint だけを動かす", () => {
    const play = openPlay(threeLines());
    play.click(yd(22, 10));

    play.drag(yd(14, 2), yd(15, 3));

    expect(lineOf(play.session.getPlayData(), "l1")?.waypoints).toEqual([yd(15, 3), yd(18, 6)]);
  });

  it("waypoint の中心から外れた点を掴むと、掴んだ点とポインタのずれを保って動く", () => {
    const play = openWithLineSelected();

    play.drag(yd(15.5, 2.25), yd(18.5, 4.25));

    expect(lineOf(play.session.getPlayData(), "l")?.waypoints).toEqual([yd(18, 4)]);
  });

  it("waypoint を掴んで動かさずに離すと、履歴に積まない", () => {
    const play = openWithLineSelected();

    play.click(yd(15, 2));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("終点のドラッグ中は、終点のハンドルと描く線の終点だけが動く", () => {
    const play = openPlay(threeLines());
    play.click(yd(22, 10));

    play.editor.pointerDown(yd(22, 10));
    play.editor.pointerMove(yd(28, 8));

    const { scene, overlay } = play.editor.getFrame();
    expect(overlay).toMatchObject({ endpointHandle: yd(28, 8) });
    expect(scene.lines.map((l) => l.end)).toEqual([yd(28, 8), yd(5, -5), yd(30, 10)]);
  });

  it("終点をドラッグして離すと、終点だけを動かす", () => {
    const play = openWithLineSelected();

    play.drag(yd(25, 5), yd(28, 8));

    expect(lineOf(play.session.getPlayData(), "l")).toMatchObject({
      waypoints: [yd(15, 2)],
      end: yd(28, 8),
    });
  });

  it("終点の中心から外れた点を掴むと、掴んだ点とポインタのずれを保って動く", () => {
    const play = openWithLineSelected();

    play.drag(yd(25.5, 5.25), yd(28.5, 8.25));

    expect(lineOf(play.session.getPlayData(), "l")?.end).toEqual(yd(28, 8));
  });

  it("終点を動かしたあとに Undo すると、元の終点に戻る", () => {
    const play = openWithLineSelected();
    play.drag(yd(25, 5), yd(28, 8));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("終点を掴んで動かさずに離すと、履歴に積まない", () => {
    const play = openWithLineSelected();

    play.click(yd(25, 5));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("終点と waypoint が重なっていると、終点を掴む", () => {
    const data = playData(
      [player("a", 10, 0)],
      [{ ...line("x"), waypoints: [yd(20, 10)], end: yd(20.2, 10) }],
    );
    const play = openPlay(data);
    play.click(yd(15, 5));

    play.drag(yd(20.2, 10), yd(30, 15));

    expect(lineOf(play.session.getPlayData(), "x")).toMatchObject({
      waypoints: [yd(20, 10)],
      end: yd(30, 15),
    });
  });

  it("waypoint のドラッグの途中で線を削除すると、離しても削除のほかに何も積まない", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(15, 2));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(16, 4));
    play.editor.pointerUp(yd(16, 4));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("終点のドラッグの途中で線を削除すると、描く図にはその線が無い", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(25, 5));
    play.editor.deleteSelection();

    play.editor.pointerMove(yd(28, 8));

    expect(play.editor.getFrame().scene.lines).toEqual([]);
  });

  it("終点のドラッグの途中で線を削除すると、離しても削除のほかに何も積まない", () => {
    const play = openWithLineSelected();
    play.editor.pointerDown(yd(25, 5));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(28, 8));
    play.editor.pointerUp(yd(28, 8));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("選んだ線のハンドルから外れた選手を押すと、その選手を選ぶ", () => {
    const play = openWithLineSelected();

    play.editor.pointerDown(yd(10, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });

  it("選んだ線が消えていると、その線のハンドルがあった位置を押しても掴まない", () => {
    const play = openWithVanishedLine();

    play.drag(yd(18, 10), yd(20, 12));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("waypoint の無い線を選んでいても、選手を押すとその選手を選ぶ", () => {
    const play = openPlay(playData([player("a", 10, 0)], [{ ...line("x"), end: yd(18, 0) }]));
    play.click(yd(14, 0));

    play.editor.pointerDown(yd(10, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });
});

describe("消えた線の選択", () => {
  it("選んだ線が Undo で消えると、表示状態は無選択になる", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("選んだ線が Undo で消えると、ハンドルを描かない", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getFrame().overlay).toEqual({ kind: "none" });
  });

  it("選んだ線が Undo で消えると、選択中の線を返さない", () => {
    const play = openWithVanishedLine();

    expect(play.editor.getSelectedLine()).toBeUndefined();
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

  it("線の削除を Undo すると、元の並びの位置に戻る", () => {
    const play = openPlay(threeLines());
    play.click(yd(5, -5));
    play.editor.deleteSelection();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(threeLines());
  });

  it("線の削除を Undo して Redo すると、また消える", () => {
    const play = openPlay(threeLines());
    play.click(yd(5, -5));
    play.editor.deleteSelection();
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData().lines.map((l) => l.id)).toEqual(["l1", "l3"]);
  });

  it("選んだ線が消えたあとに削除しても、履歴に積まない", () => {
    const play = openWithVanishedLine();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});

describe("線の値の編集", () => {
  it("選んだ線の種類、補間、太さを変える", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({ kind: "motion", interpolation: "bezier", thickness: 4 });

    expect(lineOf(play.session.getPlayData(), "l")).toMatchObject({
      kind: "motion",
      interpolation: "bezier",
      thickness: 4,
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

  it("今と同じ値だけを渡すと、履歴に積まない", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({ kind: "route", interpolation: "straight", thickness: null });

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("渡した値のうち 1 つでも今と違えば、変える", () => {
    const play = openWithLineSelected();

    play.editor.updateSelectedLine({ kind: "route", interpolation: "bezier" });

    expect(lineOf(play.session.getPlayData(), "l")?.interpolation).toBe("bezier");
  });
});
