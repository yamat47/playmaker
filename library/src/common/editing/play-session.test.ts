import { describe, expect, it, vi } from "vitest";
import { player } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import type { Formation } from "../formations/formation.js";
import type { PlayData } from "../model/play-data.js";
import { PlaySession } from "./play-session.js";

function initialData(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a", 10, 0)],
    lines: [],
  };
}

const formation: Formation = {
  id: "x",
  name: "テスト隊形",
  side: "offense",
  players: [{ position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "B" }],
};

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

describe("PlaySession の setPlayData", () => {
  it("図を読み直すと履歴を捨て、controller を作り直して onDidReset を出す", () => {
    const { session } = setup();
    session.setFieldZone("redzone");
    const before = session.controller;
    const reset = vi.fn();
    session.onDidReset(reset);

    session.setPlayData(initialData());

    expect(reset).toHaveBeenCalledOnce();
    expect(session.controller).not.toBe(before);
    expect(session.controller.getViewState().canUndo).toBe(false);
    expect(session.fieldZone).toBe("middle");
  });

  it("読み直す前の controller で編集しても、onChange は呼ばれず今の図も変わらない", () => {
    const { session, onChange } = setup();
    const stale = session.controller;
    session.setPlayData(initialData());

    stale.setFieldZone("redzone");

    expect(onChange).not.toHaveBeenCalled();
    expect(session.fieldZone).toBe("middle");
  });

  it("壊れたデータも既定の図として読み込む", () => {
    const { session } = setup("not a play");

    expect(session.getPlayData()).toEqual({ ...initialData(), players: [] });
  });
});

describe("PlaySession の loadFormation", () => {
  it("隊形の選手を追記し、編集として onChange を呼ぶ", () => {
    const { session, onChange } = setup();

    session.loadFormation(formation);

    expect(session.getPlayData().players.map((p) => p.label)).toEqual(["a", "B"]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("置ける選手が無い隊形は何もしない", () => {
    const { session, onChange } = setup();
    // 型を持たない外部の JSON から来た、位置の無い選手だけの隊形。
    const broken: Formation = JSON.parse('{ "players": [{ "shape": "circle" }] }');

    session.loadFormation(broken);

    expect(session.getPlayData()).toEqual(initialData());
    expect(onChange).not.toHaveBeenCalled();
    expect(session.controller.getViewState().canUndo).toBe(false);
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
