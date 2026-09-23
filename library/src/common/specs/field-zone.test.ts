import { describe, expect, it } from "vitest";
import { twoPlayersWithRoute } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";

describe("ゾーンの切替", () => {
  it("切り替えると、図と表示状態のゾーンが変わる", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("redzone");

    expect(play.session.fieldZone).toBe("redzone");
    expect(play.editor.getViewState().fieldZone).toBe("redzone");
  });

  it("切り替えても、選手と線の LOS からの位置は変えない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("redzone");

    const { players, lines } = twoPlayersWithRoute();
    expect(play.session.getPlayData()).toMatchObject({ players, lines });
  });

  it("切り替えたあとに Undo すると、元のゾーンと LOS に戻る", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("Undo したあとに Redo すると、また切り替える", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.session.setFieldZone("redzone");
    const switched = play.session.getPlayData();
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(switched);
  });

  it("今と同じゾーンを選び直しても、履歴に積まず通知もしない", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.session.setFieldZone("middle");

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("作図の途中で切り替えると、作図をやめる", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.session.setFieldZone("redzone");

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("作図の途中で今と同じゾーンを選び直しても、作図を続ける", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.startLine(yd(10, 0));

    play.session.setFieldZone("middle");

    expect(play.editor.getViewState().isDrawing).toBe(true);
  });
});
