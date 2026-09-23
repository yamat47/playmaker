import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, type PlayDriver, yd } from "../../test-support/play-driver.js";

/** 選手を 1 人足してから、ゾーンを切り替えた図。 */
function openAfterTwoEdits(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.editor.setTool("add-player");
  play.click(yd(30, -5));
  play.editor.setTool("select");
  play.session.setFieldZone("redzone");
  return play;
}

/** ゾーンを切り替えたあと、選手 a を掴んで動かしている途中の図。 */
function openDraggingAfterZoneSwitch(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.session.setFieldZone("redzone");
  play.editor.pointerDown(yd(10, 0));
  play.editor.pointerMove(yd(12, 2));
  return play;
}

/** ゾーンの切替を Undo したあと、選手 a から描き始めた図。 */
function openDrawingWithRedo(): PlayDriver {
  const play = openPlay(twoPlayersWithRoute());
  play.session.setFieldZone("redzone");
  play.editor.undo();
  play.startLine(yd(10, 0));
  return play;
}

function playerIds(play: PlayDriver): string[] {
  return play.session.getPlayData().players.map((p) => p.id);
}

describe("Undo と Redo", () => {
  it("開いた直後は、Undo も Redo もできない", () => {
    const play = openPlay(twoPlayersWithRoute());

    expect(play.editor.getViewState()).toMatchObject({ canUndo: false, canRedo: false });
  });

  it("編集を確定すると、Undo できるようになる", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("redzone");

    expect(play.editor.getViewState()).toMatchObject({ canUndo: true, canRedo: false });
  });

  it("Undo は、最後に確定した編集から順に戻す", () => {
    const play = openAfterTwoEdits();

    play.editor.undo();

    expect(play.session.fieldZone).toBe("middle");
    expect(playerIds(play)).toEqual(["a", "b", "player-1"]);
  });

  it("確定した編集をすべて Undo すると、開いたときの図に戻り、Undo できなくなる", () => {
    const play = openAfterTwoEdits();

    play.editor.undo();
    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState()).toMatchObject({ canUndo: false, canRedo: true });
  });

  it("Undo したあとに Redo すると、戻した編集を戻した順と逆にやり直す", () => {
    const play = openAfterTwoEdits();
    const edited = play.session.getPlayData();
    play.editor.undo();
    play.editor.undo();

    play.editor.redo();
    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(edited);
  });

  it("Undo したあとに別の編集を確定すると、Redo できなくなる", () => {
    const play = openAfterTwoEdits();
    play.editor.undo();

    play.click(yd(10, 0));
    play.editor.deleteSelection();

    expect(play.editor.getViewState().canRedo).toBe(false);
  });

  it("戻す編集が無いときの Undo と Redo は、通知を出さない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.undo();
    play.editor.redo();

    expect(play.notified).not.toHaveBeenCalled();
  });
});

describe("通知の時点の履歴", () => {
  it("ドラッグを確定した通知の中で読む canUndo は、確定したあとの値になっている", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 2));
    const seen: boolean[] = [];
    play.notified.mockImplementation(() => seen.push(play.editor.getViewState().canUndo));

    play.editor.pointerUp(yd(12, 2));

    expect(seen).toEqual([true, true]);
  });

  it("Undo の通知の中で読む canRedo は、Undo したあとの値になっている", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    const seen: boolean[] = [];
    play.notified.mockImplementation(() => seen.push(play.editor.getViewState().canRedo));

    play.editor.undo();

    expect(seen).toEqual([true, true]);
  });
});

describe("途中の操作と履歴", () => {
  it("ドラッグの途中で Undo すると、直前に確定した編集を戻す", () => {
    const play = openDraggingAfterZoneSwitch();

    play.editor.undo();

    expect(play.session.fieldZone).toBe("middle");
  });

  it("ドラッグの途中で Undo すると、そのあと離しても選手は動かない", () => {
    const play = openDraggingAfterZoneSwitch();

    play.editor.undo();
    play.editor.pointerUp(yd(12, 2));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("作図の途中で Redo すると、作図をやめる", () => {
    const play = openDrawingWithRedo();

    play.editor.redo();

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("作図の途中で Redo すると、取り消した編集をやり直す", () => {
    const play = openDrawingWithRedo();

    play.editor.redo();

    expect(play.session.fieldZone).toBe("redzone");
  });
});
