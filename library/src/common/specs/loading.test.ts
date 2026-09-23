import { describe, expect, it, vi } from "vitest";
import { manyPlayers, playData, player } from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import type { Formation } from "../formations/formation.js";
import type { PlayData } from "../model/play-data.js";
import { MAX_PLAYERS } from "../model/player.js";

function initialData(): PlayData {
  return playData([player("a", 10, 0)]);
}

const formation: Formation = {
  id: "x",
  name: "テスト隊形",
  side: "offense",
  players: [{ position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "B" }],
};

const pair: Formation = {
  id: "pair",
  name: "2 人",
  side: "offense",
  players: [
    { position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "C" },
    {
      position: { lateralYard: 32, downfieldYard: -5 },
      shape: "square",
      label: "D",
      color: "#c62828",
    },
  ],
};

const empty: Formation = { ...formation, players: [] };

/** 型を持たない外部の JSON から来た、位置の無い選手だけの隊形。 */
function brokenFormation(): Formation {
  return JSON.parse('{ "players": [{ "shape": "circle" }] }');
}

describe("図の読み直し", () => {
  it("読み直すと、それまでの編集を Undo できなくなる", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");

    play.session.setPlayData(initialData());

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("読み直すと、読み込んだ図に置き換わる", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");

    play.session.setPlayData(initialData());

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("読み直すと onDidReset を 1 回出す", () => {
    const play = openPlay(initialData());
    const reset = vi.fn();
    play.session.onDidReset(reset);

    play.session.setPlayData(initialData());

    expect(reset).toHaveBeenCalledOnce();
  });

  it("読み直したあとも、選手をドラッグして動かせる", () => {
    const play = openPlay(initialData());
    play.session.setPlayData(initialData());

    play.drag(yd(10, 0), yd(12, 3));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(12, 3));
  });

  it("読み直す前の controller で編集しても、onChange は呼ばれず今の図も変わらない", () => {
    const play = openPlay(initialData());
    const stale = play.editor;
    play.session.setPlayData(initialData());

    stale.setFieldZone("redzone");

    expect(play.onChange).not.toHaveBeenCalled();
    expect(play.session.fieldZone).toBe("middle");
  });

  it("壊れたデータも既定の図として読み込む", () => {
    const play = openPlay("not a play");

    expect(play.session.getPlayData()).toEqual(playData());
  });
});

describe("隊形の読み込み", () => {
  it("隊形の選手を今の図に追記する", () => {
    const play = openPlay(initialData());

    play.session.loadFormation(formation);

    expect(play.session.getPlayData().players.map((p) => p.label)).toEqual(["a", "B"]);
  });

  it("隊形の読み込みは編集として onChange を 1 回呼ぶ", () => {
    const play = openPlay(initialData());

    play.session.loadFormation(formation);

    expect(play.onChange).toHaveBeenCalledOnce();
  });

  it("隊形の選手を置いたら true を返す", () => {
    const play = openPlay(initialData());

    const loaded = play.session.loadFormation(formation);

    expect(loaded).toBe(true);
  });

  it("置ける選手が無い隊形は false を返す", () => {
    const play = openPlay(initialData());

    const loaded = play.session.loadFormation(brokenFormation());

    expect(loaded).toBe(false);
  });

  it("置ける選手が無い隊形では、図も履歴も変えず onChange も呼ばない", () => {
    const play = openPlay(initialData());

    play.session.loadFormation(brokenFormation());

    expect(play.session.getPlayData()).toEqual(initialData());
    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("隊形の選手には、図にある選手と重ならない id を振る", () => {
    const play = openPlay(playData([player("player-1", 10, 0)]));

    play.session.loadFormation(pair);

    const ids = play.session.getPlayData().players.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("隊形の選手の位置、形、ラベル、色をそのまま置く", () => {
    const play = openPlay(playData());

    play.session.loadFormation(pair);

    expect(play.session.getPlayData().players).toEqual([
      { id: "player-1", ...pair.players[0] },
      { id: "player-2", ...pair.players[1] },
    ]);
  });

  it("読み込むと、選択を外す", () => {
    const play = openPlay(initialData());
    play.click(yd(10, 0));

    play.session.loadFormation(formation);

    expect(play.editor.getViewState().selection).toBeNull();
  });

  it("作図の途中で読み込むと、作図をやめる", () => {
    const play = openPlay(initialData());
    play.startLine(yd(10, 0));

    play.session.loadFormation(formation);

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("読み込んだあとに Undo すると、隊形の選手だけが消える", () => {
    const play = openPlay(initialData());
    play.session.loadFormation(pair);

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("読み込むと MAX_PLAYERS 人を超える隊形は、1 人も置かず履歴にも積まない", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS - 1)));

    play.session.loadFormation(pair);

    expect(play.session.getPlayData().players).toHaveLength(MAX_PLAYERS - 1);
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("読み込むと MAX_PLAYERS 人を超える隊形は false を返す", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS - 1)));

    const loaded = play.session.loadFormation(pair);

    expect(loaded).toBe(false);
  });

  it("読み込んでちょうど MAX_PLAYERS 人になる隊形は置く", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS - 2)));

    play.session.loadFormation(pair);

    expect(play.session.getPlayData().players).toHaveLength(MAX_PLAYERS);
  });

  it("ツールバーから選手のいない隊形を読むと、false を返す", () => {
    const play = openPlay(initialData());

    const loaded = play.editor.loadFormation(empty);

    expect(loaded).toBe(false);
  });

  it("ツールバーから選手のいない隊形を読んでも、選択は外さない", () => {
    const play = openPlay(initialData());
    play.click(yd(10, 0));

    play.editor.loadFormation(empty);

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });
});
