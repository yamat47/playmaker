import { describe, expect, it, vi } from "vitest";
import { playData, player } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import { PlaySession } from "../editing/play-session.js";
import type { PlayData } from "../model/play-data.js";

function initialData(): PlayData {
  return playData([player("a", 10, 0)]);
}

describe("編集の購読", () => {
  it("編集を確定するたびに、最新の図を渡して 1 回だけ呼ぶ", () => {
    const play = openPlay(initialData());

    play.session.setFieldZone("redzone");

    expect(play.onChange).toHaveBeenCalledOnce();
    expect(must(play.onChange.mock.lastCall)[0].field.zone).toBe("redzone");
  });

  it("選手をドラッグしている間は呼ばない", () => {
    const play = openPlay(initialData());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 3));

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("選手をドラッグしている間は、描く図だけが動き、確定した図は動かない", () => {
    const play = openPlay(initialData());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 3));

    expect(play.editor.getFrame().scene.players[0]?.position).toEqual(yd(12, 3));
    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(10, 0));
  });

  it("途中の操作が無ければ、描く図は確定した図をそのまま使う", () => {
    const play = openPlay(initialData());

    expect(play.editor.getFrame().scene).toBe(play.session.getSnapshot());
  });

  it("選手をドラッグして動かすたびに、描き直しの通知を出す", () => {
    const play = openPlay(initialData());
    play.editor.pointerDown(yd(10, 0));
    play.notified.mockClear();

    play.editor.pointerMove(yd(12, 3));

    expect(play.notified).toHaveBeenCalledExactlyOnceWith("scene");
  });

  it("選手をドラッグして離すと、動かした図を渡して 1 回だけ呼ぶ", () => {
    const play = openPlay(initialData());

    play.drag(yd(10, 0), yd(12, 3));

    expect(play.onChange).toHaveBeenCalledOnce();
    expect(must(play.onChange.mock.lastCall)[0].players[0]?.position).toEqual(yd(12, 3));
  });

  it("選手をクリックして選んだだけでは呼ばない", () => {
    const play = openPlay(initialData());

    play.click(yd(10, 0));

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("Undo と Redo もそれぞれ 1 回ずつ呼ぶ", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");
    play.onChange.mockClear();

    play.editor.undo();
    play.editor.redo();

    expect(play.onChange).toHaveBeenCalledTimes(2);
  });

  it("構築したときと setPlayData で読み込んだときは呼ばない", () => {
    const play = openPlay(initialData());

    play.session.setPlayData({ ...initialData(), field: { zone: "redzone", losYard: 85 } });

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("受け取った図を書き換えても、getPlayData の結果は変わらない", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");
    const received = mutable(must(play.onChange.mock.lastCall)[0]);

    received.players.length = 0;

    expect(play.session.getPlayData().players).toHaveLength(1);
  });

  it("リスナごとに別のコピーを渡すので、先のリスナの書き換えは後のリスナに届かない", () => {
    const play = openPlay(initialData());
    play.session.onDidChange((data) => {
      mutable(data).players.length = 0;
    });
    const later = vi.fn<(data: PlayData) => void>();
    play.session.onDidChange(later);

    play.session.setFieldZone("redzone");

    expect(must(later.mock.lastCall)[0].players).toHaveLength(1);
  });

  it("購読を解除したあとの編集では呼ばない", () => {
    const play = openPlay(initialData());
    const listener = vi.fn<(data: PlayData) => void>();
    play.session.onDidChange(listener).dispose();

    play.session.setFieldZone("redzone");

    expect(listener).not.toHaveBeenCalled();
  });

  it("読み直したあとの編集でも、読み直す前からのリスナを呼ぶ", () => {
    const play = openPlay(initialData());
    play.session.setPlayData(initialData());

    play.session.setFieldZone("redzone");

    expect(play.onChange).toHaveBeenCalledOnce();
  });

  it("破棄したあとの編集では呼ばない", () => {
    const play = openPlay(initialData());
    const editor = play.editor;

    play.session.dispose();
    editor.setFieldZone("redzone");

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("破棄したあとの編集では、描き直しの通知も出さない", () => {
    const play = openPlay(initialData());
    const editor = play.editor;

    play.session.dispose();
    editor.setFieldZone("redzone");

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("購読していなくても編集できる", () => {
    const session = new PlaySession(initialData());

    session.setFieldZone("redzone");

    expect(session.getSnapshot().field.zone).toBe("redzone");
  });
});
