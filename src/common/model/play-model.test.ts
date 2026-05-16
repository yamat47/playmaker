import { describe, expect, it, vi } from "vitest";
import type { Line } from "./line.js";
import type { PlayData } from "./play-data.js";
import { PlayModel } from "./play-model.js";
import type { Player } from "./player.js";

// noUncheckedIndexedAccess 下で `!` を使わず型を絞るためのテスト局所ヘルパ。
function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}

function player(id: string, lateralYard = 5, absoluteYard = 50): Player {
  return { id, position: { lateralYard, absoluteYard }, shape: "circle", label: id };
}

function line(id: string, startPlayerId: string): Line {
  return {
    id,
    kind: "route",
    startPlayerId,
    waypoints: [],
    end: { lateralYard: 5, absoluteYard: 60 },
    interpolation: "straight",
  };
}

function seed(): PlayData {
  return {
    version: 1,
    field: { zone: "middle" },
    players: [player("a"), player("b"), player("c")],
    lines: [line("la", "a"), line("lb", "b"), line("lc", "a")],
  };
}

describe("PlayModel 構築", () => {
  it("initialData 未指定なら空の正規データを持つ", () => {
    const model = new PlayModel();

    expect(model.getData()).toEqual({
      version: 1,
      field: { zone: "middle" },
      players: [],
      lines: [],
    });
  });

  it("渡された initialData を内部へ取り込み外部入力と切り離す", () => {
    const input = seed();
    const model = new PlayModel(input);

    must(input.players[0]).label = "tampered";

    expect(model.findPlayer("a")?.label).toBe("a");
  });
});

describe("PlayModel 参照系", () => {
  it("getData は値が等しく独立したスナップショットを返し、発火しない", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const snap = model.getData();
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

  it("findPlayer / findLine は一致時に複製を、不在時に undefined を返す", () => {
    const model = new PlayModel(seed());

    const found = model.findPlayer("b");
    expect(found).toEqual(player("b"));
    must(found).label = "x";
    expect(model.findPlayer("b")?.label).toBe("b");

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
  it("addPlayer は末尾へ複製を足し、入力と切り離して発火する", () => {
    const model = new PlayModel();
    const listener = vi.fn();
    model.onDidChange(listener);
    const p = player("new");

    model.addPlayer(p);
    p.label = "tampered";

    expect(model.getData().players).toEqual([player("new")]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("updatePlayer は同 id を差し替え、直前の複製を返して発火する", () => {
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

describe("PlayModel 線の追加・挿入・削除・更新", () => {
  it("addLine は末尾へ複製を足し発火する", () => {
    const model = new PlayModel({ ...seed(), lines: [] });
    const listener = vi.fn();
    model.onDidChange(listener);
    const l = line("new", "a");

    model.addLine(l);
    l.kind = "block";

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

  it("updateLine は同 id を差し替え直前の複製を返す、未知 id は throw", () => {
    const model = new PlayModel(seed());

    const prev = model.updateLine({ ...line("lb", "b"), kind: "motion" });

    expect(prev).toEqual(line("lb", "b"));
    expect(model.findLine("lb")?.kind).toBe("motion");
    // 他の線は据え置き（差し替え三項分岐の両側）。
    expect(model.findLine("la")?.kind).toBe("route");
    expect(() => model.updateLine(line("ghost", "a"))).toThrow(/unknown line id "ghost"/);
  });
});

describe("PlayModel の発火スナップショット独立性", () => {
  it("発火で渡る PlayData を書き換えても内部状態に波及しない", () => {
    const model = new PlayModel(seed());
    let received: PlayData | undefined;
    model.onDidChange((d) => {
      received = d;
    });

    model.setFieldZone("own-redzone");
    const r = must(received);
    r.field.zone = "middle";
    must(r.players[0]).label = "tampered";

    expect(model.getData().field.zone).toBe("own-redzone");
    expect(model.findPlayer("a")?.label).toBe("a");
  });
});
