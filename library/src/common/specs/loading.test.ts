import { describe, expect, it, vi } from "vitest";
import { player } from "../../test-support/fixtures.js";
import { PlaySession } from "../editing/play-session.js";
import type { Formation } from "../formations/formation.js";
import type { PlayData } from "../model/play-data.js";

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

  it("隊形の選手を置いたら true を返す", () => {
    const { session } = setup();

    expect(session.loadFormation(formation)).toBe(true);
  });

  it("置ける選手が無い隊形は何もせず false を返す", () => {
    const { session, onChange } = setup();
    // 型を持たない外部の JSON から来た、位置の無い選手だけの隊形。
    const broken: Formation = JSON.parse('{ "players": [{ "shape": "circle" }] }');

    expect(session.loadFormation(broken)).toBe(false);

    expect(session.getPlayData()).toEqual(initialData());
    expect(onChange).not.toHaveBeenCalled();
    expect(session.controller.getViewState().canUndo).toBe(false);
  });
});
