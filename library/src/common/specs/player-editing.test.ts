import { describe, expect, it } from "vitest";
import { line, playData, player } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { openPlay, type PlayDriver, yd } from "../../test-support/play-driver.js";
import type { Line } from "../model/line.js";
import type { PlayData } from "../model/play-data.js";
import { MAX_PLAYERS, type Player } from "../model/player.js";

const A = yd(10, 0);
const B = yd(20, 0);
const EMPTY = yd(40, -10);

/** A から引いた線。A を消すと一緒に消える。 */
function routeFromA(): Line {
  return { ...line("l-1", "a"), waypoints: [yd(15, 2)], end: yd(25, 5) };
}

function initialData(): PlayData {
  return playData([player("a", 10, 0), player("b", 20, 0)], [routeFromA()]);
}

function withPlayers(count: number): PlayData {
  return playData(Array.from({ length: count }, (_, i) => player(`m-${i}`, 1 + (i % 50), -10)));
}

/** 選手を置いて選んだあと、Undo でその選手を消す。選択は消えた選手を指したまま残る。 */
function openWithUndoneAddition(): PlayDriver {
  const play = openPlay(initialData());
  play.editor.setTool("add-player");
  play.click(EMPTY);
  play.editor.undo();
  return play;
}

function playerAt(data: Pick<PlayData, "players">, id: string): Player {
  return must(data.players.find((p) => p.id === id));
}

describe("選手の追加", () => {
  it("選手の追加ツールで空いた所をクリックすると、その位置に既定の形と空のラベルで置く", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.session.getPlayData().players).toMatchObject([
      { position: yd(30, -5), shape: "circle", label: "" },
    ]);
  });

  it("置いた選手を選ぶ", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    const added = must(play.session.getPlayData().players[0]);
    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: added.id });
  });

  it("置いた選手は Undo で取り除ける", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");
    play.click(yd(30, -5));

    play.editor.undo();

    expect(play.session.getPlayData().players).toEqual([]);
  });

  it("ゾーンの窓の外をクリックすると、窓の端に置く", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -50));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(30, -15));
  });

  it("既にある選手と同じ id は振らない", () => {
    const play = openPlay(playData([player("player-1")]));
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    const ids = play.session.getPlayData().players.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("選手が MAX_PLAYERS 人いると、クリックしても置かない", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS));
    play.editor.setTool("add-player");

    play.click(yd(30, 5));

    expect(play.session.getPlayData().players).toHaveLength(MAX_PLAYERS);
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("選手が MAX_PLAYERS 人いると、置ける人数は 0 になる", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS));

    expect(play.editor.getViewState().remainingPlayerSlots).toBe(0);
  });

  it("最後の 1 人を置くと、置ける人数は 0 になる", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS - 1));
    play.editor.setTool("add-player");

    play.click(yd(30, 5));

    expect(play.editor.getViewState().remainingPlayerSlots).toBe(0);
  });
});

describe("選手の選択", () => {
  it("選手をクリックすると、その選手を選び強調する", () => {
    const play = openPlay(initialData());

    play.click(A);

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
    expect(play.editor.getFrame().overlay).toEqual({ kind: "player", playerId: "a" });
  });

  it("選んだ選手の今の値を読める", () => {
    const play = openPlay(initialData());

    play.click(A);

    expect(play.editor.getSelectedPlayer()).toEqual(playerAt(initialData(), "a"));
    expect(play.editor.getSelectedLine()).toBeUndefined();
  });

  it("選手を選んだまま空いた所をクリックすると、選択を外す", () => {
    const play = openPlay(initialData());
    play.click(A);

    play.click(EMPTY);

    expect(play.editor.getViewState().selection).toBeNull();
    expect(play.editor.getFrame().overlay).toEqual({ kind: "none" });
  });

  it("何も選んでいないときに空いた所をクリックしても、通知しない", () => {
    const play = openPlay(initialData());

    play.click(EMPTY);

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("別の選手を押すと選択が移り、描く図と表示状態を 1 回ずつ通知する", () => {
    const play = openPlay(initialData());
    play.click(A);
    play.notified.mockClear();

    play.editor.pointerDown(B);

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "b" });
    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("選んでいる選手をもう一度クリックしても、表示状態を通知しない", () => {
    const play = openPlay(initialData());
    play.click(A);
    play.notified.mockClear();

    play.click(A);

    expect(play.notified).not.toHaveBeenCalledWith("view");
  });

  it("クリックしただけでは履歴に積まない", () => {
    const play = openPlay(initialData());

    play.click(A);

    expect(play.editor.getViewState().canUndo).toBe(false);
  });
});

describe("選手のドラッグ", () => {
  it("選手をドラッグして離すと、離した位置へ動かす", () => {
    const play = openPlay(initialData());

    play.drag(A, yd(14, 3));

    expect(playerAt(play.session.getPlayData(), "a").position).toEqual(yd(14, 3));
  });

  it("中心から外れた点を掴むと、掴んだ点とのずれを保って動かす", () => {
    const play = openPlay(initialData());

    play.drag(yd(10.5, 0.25), yd(14.5, 3.25));

    expect(playerAt(play.session.getPlayData(), "a").position).toEqual(yd(14, 3));
  });

  it("中心から外れた点を掴んでいる間も、描く図は掴んだ点とのずれを保つ", () => {
    const play = openPlay(initialData());

    play.editor.pointerDown(yd(10.5, 0.25));
    play.editor.pointerMove(yd(14.5, 3.25));

    expect(playerAt(play.editor.getFrame().scene, "a").position).toEqual(yd(14, 3));
  });

  it("ドラッグで動かした選手は Undo で元の位置へ戻る", () => {
    const play = openPlay(initialData());
    play.drag(A, yd(14, 3));

    play.editor.undo();

    expect(playerAt(play.session.getPlayData(), "a").position).toEqual(A);
  });

  it("ゾーンの窓の外で離すと、窓の端に寄せて置く", () => {
    const play = openPlay(initialData());

    play.drag(A, yd(-5, 30));

    expect(playerAt(play.session.getPlayData(), "a").position).toEqual(yd(0, 15));
  });

  it("ゾーンの窓の外へ動かしている間も、描く図では窓の端で止まる", () => {
    const play = openPlay(initialData());

    play.editor.pointerDown(A);
    play.editor.pointerMove(yd(10, -30));

    expect(playerAt(play.editor.getFrame().scene, "a").position).toEqual(yd(10, -15));
  });

  it("窓の外にいる選手を動かさずにクリックしても、窓の端へは寄せない", () => {
    const play = openPlay(playData([player("far", 10, 16)]));

    play.click(yd(10, 16));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(10, 16));
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("同じ id の選手が重なっていると、上に描かれた選手を動かす", () => {
    const play = openPlay(playData([player("p", 10, 0), player("p", 10, 0)]));

    play.drag(A, yd(14, 0));

    expect(play.session.getPlayData().players.map((p) => p.position)).toEqual([A, yd(14, 0)]);
  });
});

describe("選手の削除", () => {
  it("選んだ選手を消すと、その選手から引いた線も一緒に消える", () => {
    const play = openPlay(initialData());
    play.click(A);

    play.editor.deleteSelection();

    const data = play.session.getPlayData();
    expect(data.players.map((p) => p.id)).toEqual(["b"]);
    expect(data.lines).toEqual([]);
  });

  it("消したあとは何も選んでいない", () => {
    const play = openPlay(initialData());
    play.click(A);

    play.editor.deleteSelection();

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("消した選手は Undo で線ごと元の並びに戻る", () => {
    const play = openPlay(initialData());
    play.click(A);
    play.editor.deleteSelection();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("何も選んでいなければ、何もせず通知もしない", () => {
    const play = openPlay(initialData());

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual(initialData());
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("選んでいた選手が Undo で消えると、何も選んでいない表示になる", () => {
    const play = openPlay(initialData());
    play.editor.setTool("add-player");
    play.click(EMPTY);

    play.editor.undo();

    expect(play.editor.getViewState().selection).toBeNull();
    expect(play.editor.getSelectedPlayer()).toBeUndefined();
  });

  it("選んでいた選手が Undo で消えたあとに削除しても、何もしない", () => {
    const play = openWithUndoneAddition();

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual(initialData());
    expect(play.editor.getViewState().canRedo).toBe(true);
  });

  it("Undo で消えた選手が Redo で戻ると、また選んでいる表示になる", () => {
    const play = openPlay(initialData());
    play.editor.setTool("add-player");
    play.click(EMPTY);
    const added = play.editor.getViewState().selection;
    play.editor.undo();

    play.editor.redo();

    expect(play.editor.getViewState().selection).toEqual(added);
  });
});

describe("パネルからの選手の編集", () => {
  it("選んだ選手のラベル、形、色を変える", () => {
    const play = openPlay(initialData());
    play.click(A);

    play.editor.updateSelectedPlayer({ label: "Z", shape: "square", color: "#f00" });

    expect(playerAt(play.session.getPlayData(), "a")).toMatchObject({
      label: "Z",
      shape: "square",
      color: "#f00",
    });
  });

  it("渡したパッチをあとで書き換えても、Redo で当てる値は変わらない", () => {
    const play = openPlay(initialData());
    play.click(A);
    const patch = { label: "QB" };
    play.editor.updateSelectedPlayer(patch);
    patch.label = "RB";
    play.editor.undo();

    play.editor.redo();

    expect(playerAt(play.session.getPlayData(), "a").label).toBe("QB");
  });

  it("変えた値は Undo で元に戻る", () => {
    const play = openPlay(initialData());
    play.click(A);
    play.editor.updateSelectedPlayer({ label: "Z" });

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("色に null を渡すと、色を外して既定の色に戻す", () => {
    const play = openPlay(playData([{ ...player("a", 10, 0), color: "#f00" }]));
    play.click(A);

    play.editor.updateSelectedPlayer({ color: null });

    expect(play.session.getPlayData().players[0]).not.toHaveProperty("color");
  });

  it("何も選んでいなければ、何も変えない", () => {
    const play = openPlay(initialData());

    play.editor.updateSelectedPlayer({ label: "Z" });

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("線を選んでいるときは、何も変えない", () => {
    const play = openPlay(initialData());
    play.click(yd(25, 5));

    play.editor.updateSelectedPlayer({ label: "Z" });

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("選んでいた選手が Undo で消えていれば、何も変えない", () => {
    const play = openWithUndoneAddition();

    play.editor.updateSelectedPlayer({ label: "Z" });

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("今と同じ値だけを渡すと、履歴に積まず通知もしない", () => {
    const play = openPlay(initialData());
    play.click(A);
    play.notified.mockClear();

    play.editor.updateSelectedPlayer({ label: "a", shape: "circle" });

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("色のない選手の色を外しても、履歴に積まない", () => {
    const play = openPlay(initialData());
    play.click(A);

    play.editor.updateSelectedPlayer({ color: null });

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("渡した値のうち 1 つでも今と違えば変える", () => {
    const play = openPlay(initialData());
    play.click(A);

    play.editor.updateSelectedPlayer({ label: "a", shape: "square" });

    expect(playerAt(play.session.getPlayData(), "a").shape).toBe("square");
  });

  it("表示状態が同じままでも、選んだ選手の値が変われば表示状態を通知する", () => {
    const play = openPlay(initialData());
    play.click(A);
    play.editor.updateSelectedPlayer({ label: "QB" });
    play.notified.mockClear();

    play.editor.updateSelectedPlayer({ label: "RB" });

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});
