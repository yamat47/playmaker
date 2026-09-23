import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

/** 選手を足して選んだあと、Undo でその選手を消した状態。選択はその選手を指したまま残る。 */
function openWithVanishedSelection() {
  const play = openPlay(twoPlayersWithRoute());
  play.editor.setTool("add-player");
  play.click(yd(30, -5));
  play.editor.setTool("select");
  play.editor.undo();
  return play;
}

describe("クリックでの選択", () => {
  it("選手をクリックすると、その選手を選ぶ", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });

  it("選手を選ぶと、その選手を強調して描く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getFrame().overlay).toEqual({ kind: "player", playerId: "a" });
  });

  it("選手を選ぶと、選択中の選手としてその選手を返し、線は返さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getSelectedPlayer()?.id).toBe("a");
    expect(play.editor.getSelectedLine()).toBeUndefined();
  });

  it("線をクリックすると、その線を選ぶ", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(25, 5));

    expect(play.editor.getViewState().selection).toEqual({ kind: "line", id: "l" });
  });

  it("線を選ぶと、選択中の線としてその線を返し、選手は返さない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(25, 5));

    expect(play.editor.getSelectedLine()?.id).toBe("l");
    expect(play.editor.getSelectedPlayer()).toBeUndefined();
  });

  it("線を選ぶと、waypoint と終点にハンドルを描く", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(25, 5));

    expect(play.editor.getFrame().overlay).toEqual({
      kind: "line",
      waypointHandles: [yd(15, 2)],
      endpointHandle: yd(25, 5),
    });
  });

  it("空白をクリックすると、選択を外す", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.click(yd(45, -10));

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("何も選んでいないときに空白をクリックしても、通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(45, -10));

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("選んでいる選手をもう一度クリックしても、表示状態の通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.notified.mockClear();

    play.click(yd(10, 0));

    expect(play.notified).not.toHaveBeenCalledWith("view");
  });

  it("別の選手を押すと、選択がその選手へ移る", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));

    play.click(yd(20, 0));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "b" });
  });

  it("別の選手を押すと、描く図と表示状態の通知を 1 回ずつ出す", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.notified.mockClear();

    play.editor.pointerDown(yd(20, 0));

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("消えた対象の選択", () => {
  it("選んだ選手が Undo で消えると、表示状態は無選択になる", () => {
    const play = openWithVanishedSelection();

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("選んだ選手が Undo で消えると、選択中の選手を返さない", () => {
    const play = openWithVanishedSelection();

    expect(play.editor.getSelectedPlayer()).toBeUndefined();
  });

  it("消えた選手が Redo で戻ると、また選択として読める", () => {
    const play = openWithVanishedSelection();

    play.editor.redo();

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "player-1" });
  });
});

describe("選択の削除", () => {
  it("選んでいる選手を削除すると、選択を外す", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(20, 0));

    play.editor.deleteSelection();

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("何も選んでいないときに削除しても、図も履歴も変えず通知もしない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("選んだ選手が消えたあとに削除しても、履歴に積まない", () => {
    const play = openWithVanishedSelection();

    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(true);
  });
});
