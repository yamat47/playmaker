import { describe, expect, it } from "vitest";
import { manyPlayers, playData, player, twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import type { PlayData } from "../model/play-data.js";
import { MAX_PLAYERS } from "../model/player.js";

function withPlayers(count: number): PlayData {
  return playData(manyPlayers(count));
}

function positionOf(data: Pick<PlayData, "players">, id: string) {
  return data.players.find((p) => p.id === id)?.position;
}

/** 選手 a を選んだ図。 */
function openWithASelected() {
  const play = openPlay(twoPlayersWithRoute());
  play.click(yd(10, 0));
  return play;
}

describe("選手の追加", () => {
  it("選手の追加ツールで空白をクリックすると、そこにラベルの無い丸の選手を足す", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.session.getPlayData().players).toEqual([
      { id: "player-1", position: yd(30, -5), shape: "circle", label: "" },
    ]);
  });

  it("足した選手を選ぶ", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "player-1" });
  });

  it("足す選手には、図にある選手と重ならない id を振る", () => {
    const play = openPlay(playData([player("player-1", 10, 0)]));
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    const ids = play.session.getPlayData().players.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("ゾーンの窓の外をクリックすると、窓の端に置く", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -50));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(30, -15));
  });

  it("足したあとに Undo すると、足した選手が消える", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");
    play.click(yd(30, -5));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("選手が MAX_PLAYERS 人いると、クリックしても足さず履歴にも積まない", () => {
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

  it("最後の 1 人を足すと、置ける人数は 0 になる", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS - 1));
    play.editor.setTool("add-player");

    play.click(yd(30, 5));

    expect(play.editor.getViewState().remainingPlayerSlots).toBe(0);
  });
});

describe("選手のドラッグ", () => {
  it("中心から外れた点を掴んで動かすと、掴んだ点とポインタのずれを保って描く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10.5, 0.25));
    play.editor.pointerMove(yd(14.5, 3.25));

    expect(positionOf(play.editor.getFrame().scene, "a")).toEqual(yd(14, 3));
  });

  it("中心から外れた点を掴んで離すと、掴んだ点とポインタのずれを保った位置に置く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10.5, 0.25), yd(14.5, 3.25));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(14, 3));
  });

  it("動かさずに離すと、履歴に積まない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("ゾーンの窓の外へ動かすと、描く選手は窓の端で止まる", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(10, -30));

    expect(positionOf(play.editor.getFrame().scene, "a")).toEqual(yd(10, -15));
  });

  it("ゾーンの窓の外で離すと、窓の端に寄せて置く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(-5, 30));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(0, 15));
  });

  it("窓の外にいる選手をクリックしただけでは、窓の端へ動かさない", () => {
    const play = openPlay(playData([player("far", 10, 16)]));

    play.click(yd(10, 16));

    expect(positionOf(play.session.getPlayData(), "far")).toEqual(yd(10, 16));
  });

  it("押さずにポインタを動かして離しても、通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerMove(yd(10, 0));
    play.editor.pointerUp(yd(10, 0));

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("ドラッグの途中で選手を削除すると、離しても削除のほかに何も積まない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(14, 4));
    play.editor.pointerUp(yd(14, 4));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("同じ id の選手が重なっていても、上に描かれた選手だけを動かす", () => {
    const play = openPlay(
      playData([
        { ...player("p", 10, 0), label: "下" },
        { ...player("p", 10, 0), label: "上" },
      ]),
    );

    play.drag(yd(10, 0), yd(14, 0));

    const moved = play.session.getPlayData().players.map((p) => [p.label, p.position]);
    expect(moved).toEqual([
      ["下", yd(10, 0)],
      ["上", yd(14, 0)],
    ]);
  });
});

describe("選手の削除", () => {
  it("選手を削除すると、その選手から出る線も消える", () => {
    const play = openWithASelected();

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual(playData([player("b", 20, 0)]));
  });

  it("選手と線を一緒に消しても、onChange は 1 回だけ呼ぶ", () => {
    const play = openWithASelected();

    play.editor.deleteSelection();

    expect(play.onChange).toHaveBeenCalledOnce();
  });

  it("削除を Undo すると、選手と線が元の並びに戻る", () => {
    const play = openWithASelected();
    play.editor.deleteSelection();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("削除を Undo してから Redo すると、選手と線をまた消す", () => {
    const play = openWithASelected();
    play.editor.deleteSelection();
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(playData([player("b", 20, 0)]));
  });
});

describe("選手の値の編集", () => {
  it("選んでいる選手のラベル、形、色を変える", () => {
    const play = openWithASelected();

    play.editor.updateSelectedPlayer({ label: "QB", shape: "square", color: "#ff0000" });

    expect(play.session.getPlayData().players[0]).toEqual({
      ...player("a", 10, 0),
      label: "QB",
      shape: "square",
      color: "#ff0000",
    });
  });

  it("色に null を渡すと、色を持たない既定の選手に戻る", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ color: "#ff0000" });

    play.editor.updateSelectedPlayer({ color: null });

    expect(play.session.getPlayData().players[0]).toEqual(player("a", 10, 0));
  });

  it("変えたあとに Undo すると、変える前の値に戻る", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ label: "QB" });

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("渡したパッチをあとで書き換えても、Redo で当てる値は変わらない", () => {
    const play = openWithASelected();
    const patch = { label: "QB" };
    play.editor.updateSelectedPlayer(patch);
    patch.label = "RB";
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("線を選んでいるときは、選手の値を変えない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(25, 5));

    play.editor.updateSelectedPlayer({ label: "QB" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("何も選んでいないときは、選手の値を変えない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.updateSelectedPlayer({ label: "QB" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("選んだ選手が消えたあとに値を変えても、履歴に積まない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");
    play.click(yd(30, -5));
    play.editor.undo();

    play.editor.updateSelectedPlayer({ label: "QB" });

    expect(play.editor.getViewState().canRedo).toBe(true);
  });

  it("今と同じ値だけを渡すと、履歴に積まず通知もしない", () => {
    const play = openWithASelected();
    play.notified.mockClear();

    play.editor.updateSelectedPlayer({ label: "a", shape: "circle" });

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("色の無い選手に null の色を渡しても、履歴に積まない", () => {
    const play = openWithASelected();

    play.editor.updateSelectedPlayer({ color: null });

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("表示状態が変わらなくても、選んでいる選手の値が変われば表示状態を通知する", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ label: "QB" });
    play.notified.mockClear();

    play.editor.updateSelectedPlayer({ label: "RB" });

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});
