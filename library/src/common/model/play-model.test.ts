import { describe, expect, it, vi } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import type { PlayData } from "./play-data.js";
import { PlayModel } from "./play-model.js";

function seed(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a"), player("b"), player("c")],
    lines: [line("la", "a"), line("lb", "b"), line("lc", "a")],
  };
}

describe("PlayModel 構築", () => {
  it("initialData 未指定なら空の正規データを持つ", () => {
    const model = new PlayModel();

    expect(model.getData()).toEqual({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [],
      lines: [],
    });
  });

  it("渡された initialData を内部へ取り込み外部入力と切り離す", () => {
    const input = mutable(seed());
    const model = new PlayModel(input);

    must(input.players[0]).label = "tampered";

    expect(model.findPlayer("a")?.label).toBe("a");
  });

  it("版なしの旧来 blob も migratePlayData 経由で現行版へ寄せて取り込む", () => {
    // 商用ソフトが永続化した未バージョン化データの再読込（PRD 6.6 唯一の入口）。
    const legacy = {
      field: { zone: "redzone", losYard: 85 },
      players: [{ id: "wr", position: { lateralYard: 5, downfieldYard: 50 }, shape: "square" }],
    } as unknown as PlayData;

    const model = new PlayModel(legacy);

    expect(model.getData().version).toBe(1);
    expect(model.getFieldZone()).toBe("redzone");
    expect(model.findPlayer("wr")?.shape).toBe("square");
  });
});

describe("PlayModel 参照系", () => {
  it("getData は値が等しく独立したスナップショットを返し、発火しない", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const snap = mutable(model.getData());
    must(snap.players[0]).label = "edited";

    expect(model.findPlayer("a")?.label).toBe("a");
    expect(listener).not.toHaveBeenCalled();
  });

  it("getFieldZone は現在ゾーンを値で返す（深いコピーなし）", () => {
    const model = new PlayModel(seed());

    expect(model.getFieldZone()).toBe("middle");
    model.setFieldZone("redzone");
    expect(model.getFieldZone()).toBe("redzone");
  });

  it("id が一致する選手と線を返し、なければ undefined を返す", () => {
    const model = new PlayModel(seed());

    expect(model.findPlayer("b")).toEqual(player("b"));
    expect(model.findPlayer("zzz")).toBeUndefined();
    expect(model.findLine("la")).toEqual(line("la", "a"));
    expect(model.findLine("zzz")).toBeUndefined();
  });
});

describe("PlayModel.setFieldZone", () => {
  it("ゾーンを変更しスナップショットを 1 回発火する", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn<(data: PlayData) => void>();
    model.onDidChange(listener);

    model.setFieldZone("redzone");

    expect(model.getData().field.zone).toBe("redzone");
    expect(listener).toHaveBeenCalledOnce();
    expect(must(listener.mock.calls[0])[0].field.zone).toBe("redzone");
  });
});

describe("PlayModel 選手の追加・更新", () => {
  it("追加した選手は末尾に並び、1 回だけ通知する", () => {
    const model = new PlayModel();
    const listener = vi.fn();
    model.onDidChange(listener);

    model.addPlayer(player("new"));

    expect(model.getData().players).toEqual([player("new")]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("選手を更新すると同じ id を差し替え、差し替え前の選手を返して通知する", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const prev = model.updatePlayer({ ...player("b"), label: "Bee" });

    expect(prev).toEqual(player("b"));
    expect(model.findPlayer("b")?.label).toBe("Bee");
    // 他の選手は据え置き（差し替えの三項分岐の両側を踏む）。
    expect(model.findPlayer("a")?.label).toBe("a");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("updatePlayer は未知 id で throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.updatePlayer(player("ghost"))).toThrow(/unknown player id "ghost"/);
  });
});

describe("PlayModel の id 重複の拒否", () => {
  it("addPlayer は既にある id の選手を渡すと throw し、状態も通知も変えない", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.addPlayer(player("a"))).toThrow('duplicate player id "a"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("addPlayers は既存と重複する id を含むと、前の選手も足さずに throw する", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.addPlayers([player("d"), player("b")])).toThrow('duplicate player id "b"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("addPlayers は渡した選手どうしで id が重なると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.addPlayers([player("d"), player("d")])).toThrow('duplicate player id "d"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("addLine は既にある id の線を渡すと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.addLine(line("la", "b"))).toThrow('duplicate line id "la"');
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);
  });

  it("insertLine は既にある id の線を渡すと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.insertLine(line("lb", "a"), 0)).toThrow(
      'PlayModel.insertLine: duplicate line id "lb"',
    );
  });

  it("restorePlayer は同じ id の選手が既にあると throw する", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("b");
    model.addPlayer(player("b"));

    expect(() => model.restorePlayer(removal)).toThrow(
      'PlayModel.restorePlayer: duplicate player id "b"',
    );
  });
});

describe("PlayModel.removePlayer / restorePlayer", () => {
  it("選手と起点が一致する線をカスケード除去し、メメントと位置を返す", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const removal = model.removePlayer("a");

    expect(removal.index).toBe(0);
    expect(removal.player).toEqual(player("a"));
    // la(0) と lc(2) が a 起点。lb は残る（forEach の if/else 両側）。
    expect(removal.removedLines.map((r) => [r.line.id, r.index])).toEqual([
      ["la", 0],
      ["lc", 2],
    ]);
    expect(model.getData().players.map((p) => p.id)).toEqual(["b", "c"]);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["lb"]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("restorePlayer は選手と従属線を元の並びへ戻し 1 回発火する", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("a");
    const listener = vi.fn();
    model.onDidChange(listener);

    model.restorePlayer(removal);

    expect(model.getData()).toEqual(seed());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("従属線が無い選手の削除と復元（カスケード 0 件）", () => {
    const model = new PlayModel(seed());

    const removal = model.removePlayer("c");
    expect(removal.removedLines).toEqual([]);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);

    model.restorePlayer(removal);
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("removePlayer は未知 id で throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.removePlayer("ghost")).toThrow(/unknown player id "ghost"/);
  });
});

describe("PlayModel.addPlayers / removePlayers（一括・単一発火）", () => {
  it("複数の選手をまとめて追加しても、末尾に並べて 1 回だけ通知する", () => {
    const model = new PlayModel();
    const listener = vi.fn();
    model.onDidChange(listener);

    model.addPlayers([player("x", 1, 1), player("y", 2, 2)]);

    expect(model.getData().players.map((p) => p.id)).toEqual(["x", "y"]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("removePlayers は複数選手と従属線をカスケード除去し 1 回発火、メメント順を保つ", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const removals = model.removePlayers(["a", "b"]);

    expect(removals.map((r) => r.player.id)).toEqual(["a", "b"]);
    // a 起点の la/lc が先に消え、続いて（残り lines に対して）b 起点の lb が消える。
    expect(removals[0]?.removedLines.map((r) => r.line.id)).toEqual(["la", "lc"]);
    expect(removals[1]?.removedLines.map((r) => r.line.id)).toEqual(["lb"]);
    expect(model.getData().players.map((p) => p.id)).toEqual(["c"]);
    expect(model.getData().lines).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("removePlayers は未知 id を含むと throw する（コア共有の契約）", () => {
    const model = new PlayModel(seed());

    expect(() => model.removePlayers(["a", "ghost"])).toThrow(/unknown player id "ghost"/);
  });
});

describe("PlayModel 線の追加・挿入・削除・更新", () => {
  it("追加した線は末尾に並び、1 回だけ通知する", () => {
    const model = new PlayModel({ ...seed(), lines: [] });
    const listener = vi.fn();
    model.onDidChange(listener);

    model.addLine(line("new", "a"));

    expect(model.getData().lines).toEqual([line("new", "a")]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("insertLine は指定位置へ挿入し、範囲外はクランプする", () => {
    const model = new PlayModel({ ...seed(), lines: [line("x", "a"), line("y", "b")] });

    model.insertLine(line("mid", "c"), 1);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["x", "mid", "y"]);

    model.insertLine(line("head", "c"), -5);
    model.insertLine(line("tail", "c"), 999);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["head", "x", "mid", "y", "tail"]);
  });

  it("removeLine は線を除去しメメントを返して発火、未知 id は throw", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const removal = model.removeLine("lb");

    expect(removal).toEqual({ line: line("lb", "b"), index: 1 });
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lc"]);
    expect(listener).toHaveBeenCalledOnce();
    expect(() => model.removeLine("ghost")).toThrow(/unknown line id "ghost"/);
  });

  it("線を更新すると同じ id を差し替えて差し替え前の線を返し、未知の id は throw する", () => {
    const model = new PlayModel(seed());

    const prev = model.updateLine({ ...line("lb", "b"), kind: "motion" });

    expect(prev).toEqual(line("lb", "b"));
    expect(model.findLine("lb")?.kind).toBe("motion");
    // 他の線は据え置き（差し替え三項分岐の両側）。
    expect(model.findLine("la")?.kind).toBe("route");
    expect(() => model.updateLine(line("ghost", "a"))).toThrow(/unknown line id "ghost"/);
  });
});

describe("PlayModel の発火", () => {
  it("変更後の getSnapshot と同じ値を渡す", () => {
    const model = new PlayModel(seed());
    let received: PlayData | undefined;
    model.onDidChange((d) => {
      received = d;
    });

    model.setFieldZone("own-redzone");

    expect(received).toBe(model.getSnapshot());
  });
});

describe("PlayModel の軽い読み取り", () => {
  it("変更がなければ同じスナップショットを返し、変更すると新しいものに替わる", () => {
    const model = new PlayModel(seed());
    const before = model.getSnapshot();

    expect(model.getSnapshot()).toBe(before);

    model.setFieldZone("redzone");

    expect(model.getSnapshot()).not.toBe(before);
    expect(before.field.zone).toBe("middle");
    expect(model.getSnapshot().field.zone).toBe("redzone");
  });

  it("選手の id があるかどうかを返す", () => {
    const model = new PlayModel(seed());

    expect(model.hasPlayer("a")).toBe(true);
    expect(model.hasPlayer("zzz")).toBe(false);
  });
});

describe("PlayModel の破棄", () => {
  it("dispose 後の変更は購読者へ通知しない", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    model.dispose();
    model.setFieldZone("redzone");

    expect(listener).not.toHaveBeenCalled();
  });
});
