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

describe("Change subscription", () => {
  it("passes the latest diagram exactly once each time an edit is committed", () => {
    const play = openPlay(initialData());

    play.session.setFieldZone("redzone");

    expect(play.onChange).toHaveBeenCalledOnce();
    expect(must(play.onChange.mock.lastCall)[0].field.zone).toBe("redzone");
  });

  it("does not call the listener while a player is being dragged", () => {
    const play = openPlay(initialData());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 3));

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("moves the drawn diagram but not the committed diagram while a player is dragged", () => {
    const play = openPlay(initialData());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 3));

    expect(play.editor.getFrame().scene.players[0]?.position).toEqual(yd(12, 3));
    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(10, 0));
  });

  it("uses the committed diagram as the drawn diagram when no operation is in progress", () => {
    const play = openPlay(initialData());

    expect(play.editor.getFrame().scene).toBe(play.session.getSnapshot());
  });

  it("emits a redraw notification each time a dragged player moves", () => {
    const play = openPlay(initialData());
    play.editor.pointerDown(yd(10, 0));
    play.notified.mockClear();

    play.editor.pointerMove(yd(12, 3));

    expect(play.notified).toHaveBeenCalledExactlyOnceWith("scene");
  });

  it("passes the moved diagram exactly once when a player is dragged and released", () => {
    const play = openPlay(initialData());

    play.drag(yd(10, 0), yd(12, 3));

    expect(play.onChange).toHaveBeenCalledOnce();
    expect(must(play.onChange.mock.lastCall)[0].players[0]?.position).toEqual(yd(12, 3));
  });

  it("does not call the listener when a player is only clicked and selected", () => {
    const play = openPlay(initialData());

    play.click(yd(10, 0));

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("calls the listener once for Undo and once for Redo", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");
    play.onChange.mockClear();

    play.editor.undo();
    play.editor.redo();

    expect(play.onChange).toHaveBeenCalledTimes(2);
  });

  it("does not call the listener on construction or when setPlayData loads a diagram", () => {
    const play = openPlay(initialData());

    play.session.setPlayData({ ...initialData(), field: { zone: "redzone", losYard: 85 } });

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("keeps the result of getPlayData unchanged when the received diagram is mutated", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");
    const received = mutable(must(play.onChange.mock.lastCall)[0]);

    received.players.length = 0;

    expect(play.session.getPlayData().players).toHaveLength(1);
  });

  it("gives each listener its own copy, so a mutation in one does not reach the next", () => {
    const play = openPlay(initialData());
    play.session.onDidChange((data) => {
      mutable(data).players.length = 0;
    });
    const later = vi.fn<(data: PlayData) => void>();
    play.session.onDidChange(later);

    play.session.setFieldZone("redzone");

    expect(must(later.mock.lastCall)[0].players).toHaveLength(1);
  });

  it("does not call a listener after it unsubscribes", () => {
    const play = openPlay(initialData());
    const listener = vi.fn<(data: PlayData) => void>();
    play.session.onDidChange(listener).dispose();

    play.session.setFieldZone("redzone");

    expect(listener).not.toHaveBeenCalled();
  });

  it("still calls a listener subscribed before a reload when an edit follows the reload", () => {
    const play = openPlay(initialData());
    play.session.setPlayData(initialData());

    play.session.setFieldZone("redzone");

    expect(play.onChange).toHaveBeenCalledOnce();
  });

  it("does not call the listener when an edit follows dispose", () => {
    const play = openPlay(initialData());
    const editor = play.editor;

    play.session.dispose();
    editor.setFieldZone("redzone");

    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("does not notify a redraw when an edit follows dispose", () => {
    const play = openPlay(initialData());
    const editor = play.editor;

    play.session.dispose();
    editor.setFieldZone("redzone");

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("accepts edits without a subscriber", () => {
    const session = new PlaySession(initialData());

    session.setFieldZone("redzone");

    expect(session.getSnapshot().field.zone).toBe("redzone");
  });
});
