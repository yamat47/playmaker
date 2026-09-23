import { describe, expect, it, vi } from "vitest";
import { player } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import { PlaySession } from "../editing/play-session.js";
import type { PlayData } from "../model/play-data.js";

function initialData(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a", 10, 0)],
    lines: [],
  };
}

function setup(data: unknown = initialData()) {
  const onChange = vi.fn<(data: PlayData) => void>();
  const session = new PlaySession(data);
  session.onDidChange(onChange);
  return { session, onChange };
}

describe("PlaySession の onDidChange", () => {
  it("編集を確定するたびに、最新の図を渡して 1 回だけ呼ぶ", () => {
    const { session, onChange } = setup();

    session.setFieldZone("redzone");

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.lastCall?.[0].field.zone).toBe("redzone");
  });

  it("Undo と Redo もそれぞれ 1 回ずつ呼ぶ", () => {
    const { session, onChange } = setup();
    session.setFieldZone("redzone");
    onChange.mockClear();

    session.controller.undo();
    session.controller.redo();

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("構築したときと setPlayData で読み込んだときは呼ばない", () => {
    const { session, onChange } = setup();

    session.setPlayData({ ...initialData(), field: { zone: "redzone", losYard: 85 } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("受け取った図を書き換えても、getPlayData の結果は変わらない", () => {
    const { session, onChange } = setup();
    session.setFieldZone("redzone");
    const received = mutable(must(onChange.mock.lastCall)[0]);

    received.players.length = 0;

    expect(session.getPlayData().players).toHaveLength(1);
  });

  it("リスナごとに別のコピーを渡すので、先のリスナの書き換えは後のリスナに届かない", () => {
    const session = new PlaySession(initialData());
    session.onDidChange((data) => {
      mutable(data).players.length = 0;
    });
    const later = vi.fn<(data: PlayData) => void>();
    session.onDidChange(later);

    session.setFieldZone("redzone");

    expect(must(later.mock.lastCall)[0].players).toHaveLength(1);
  });

  it("購読を解除したあとの編集では呼ばない", () => {
    const session = new PlaySession(initialData());
    const onChange = vi.fn<(data: PlayData) => void>();
    session.onDidChange(onChange).dispose();

    session.setFieldZone("redzone");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("読み直したあとの編集でも、読み直す前からのリスナを呼ぶ", () => {
    const { session, onChange } = setup();
    session.setPlayData(initialData());

    session.setFieldZone("redzone");

    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("PlaySession の dispose", () => {
  it("破棄したあとの編集では onChange を呼ばない", () => {
    const { session, onChange } = setup();
    const controller = session.controller;

    session.dispose();
    controller.setFieldZone("redzone");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("購読していなくても編集できる", () => {
    const session = new PlaySession(initialData());

    session.setFieldZone("redzone");

    expect(session.getSnapshot().field.zone).toBe("redzone");
  });
});
