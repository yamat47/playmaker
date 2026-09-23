import { describe, expect, it, vi } from "vitest";
import { line, player } from "../../test-support/fixtures.js";
import { must } from "../../test-support/must.js";
import { mutable } from "../../test-support/mutable.js";
import { type Line, MAX_LINES, MAX_WAYPOINTS_PER_LINE } from "./line.js";
import { CURRENT_PLAY_DATA_VERSION, LOS_YARD_BY_ZONE, type PlayData } from "./play-data.js";
import { PlayModel } from "./play-model.js";
import { type FieldPosition, MAX_PLAYERS, type Player } from "./player.js";

function seed(): PlayData {
  return {
    version: 2,
    field: { zone: "middle", losYard: 50 },
    players: [player("a"), player("b"), player("c")],
    lines: [line("la", "a"), line("lb", "b"), line("lc", "a")],
  };
}

describe("PlayModel 構築", () => {
  it("図を渡さずに作ると、空の図を持つ", () => {
    const model = new PlayModel();

    expect(model.getData()).toEqual({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [],
      lines: [],
    });
  });

  it("作ったあとで渡した図を書き換えても、モデルの図は変わらない", () => {
    const input = mutable(seed());
    const model = new PlayModel(input);

    must(input.players[0]).label = "tampered";

    expect(model.findPlayer("a")?.label).toBe("a");
  });

  it("版の無い旧来の図も、今の版に移して取り込む", () => {
    // 商用ソフトが永続化した未バージョン化データの再読込（PRD 6.6 唯一の入口）。
    const legacy = {
      field: { zone: "redzone" },
      players: [{ id: "wr", position: { lateralYard: 5, absoluteYard: 90 }, shape: "square" }],
    };

    const model = new PlayModel(legacy);

    expect(model.getData().version).toBe(CURRENT_PLAY_DATA_VERSION);
    expect(model.getFieldZone()).toBe("redzone");
    expect(model.findPlayer("wr")).toMatchObject({
      shape: "square",
      position: { lateralYard: 5, downfieldYard: 90 - LOS_YARD_BY_ZONE.redzone },
    });
  });
});

describe("PlayModel 参照系", () => {
  it("読み取った図を書き換えても、モデルの図は変わらない", () => {
    const model = new PlayModel(seed());

    const snap = mutable(model.getData());
    must(snap.players[0]).label = "edited";

    expect(model.findPlayer("a")?.label).toBe("a");
  });

  it("図を読み取るだけでは通知しない", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    model.getData();

    expect(listener).not.toHaveBeenCalled();
  });

  it("ゾーンを切り替えると、読み取るゾーンも切り替わる", () => {
    const model = new PlayModel(seed());

    expect(model.getFieldZone()).toBe("middle");
    model.setFieldZone("redzone");
    expect(model.getFieldZone()).toBe("redzone");
  });

  it("選手を id で探すと、その選手を返し、無い id なら undefined を返す", () => {
    const model = new PlayModel(seed());

    expect(model.findPlayer("b")).toEqual(player("b"));
    expect(model.findPlayer("zzz")).toBeUndefined();
  });

  it("線を id で探すと、その線を返し、無い id なら undefined を返す", () => {
    const model = new PlayModel(seed());

    expect(model.findLine("la")).toEqual(line("la", "a"));
    expect(model.findLine("zzz")).toBeUndefined();
  });
});

describe("PlayModel.setFieldZone", () => {
  it("ゾーンを切り替えると LOS もそのゾーンの既定へ移り、選手の LOS からの位置は変わらない", () => {
    const model = new PlayModel(seed());

    model.setFieldZone("redzone");

    expect(model.getData().field).toEqual({ zone: "redzone", losYard: LOS_YARD_BY_ZONE.redzone });
    expect(model.findPlayer("a")).toEqual(player("a"));
  });

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
    expect(model.findPlayer("a")?.label).toBe("a");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("無い id の選手を差し替えようとすると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.updatePlayer(player("ghost"))).toThrow(/unknown player id "ghost"/);
  });

  it("無い id の選手を引くと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.getPlayer("ghost")).toThrow(/unknown player id "ghost"/);
  });
});

describe("PlayModel の id 重複の拒否", () => {
  it("既にある id の選手を足すと throw し、図も通知も変えない", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.addPlayer(player("a"))).toThrow('duplicate player id "a"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("まとめて足す選手に既にある id が混じると、前に並んだ選手も足さずに throw する", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.addPlayers([player("d"), player("b")])).toThrow('duplicate player id "b"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("まとめて足す選手どうしで id が重なると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.addPlayers([player("d"), player("d")])).toThrow('duplicate player id "d"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("既にある id の線を足すと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.addLine(line("la", "b"))).toThrow('duplicate line id "la"');
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);
  });

  it("既にある id の線を位置を指定して差し込むと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.insertLine(line("lb", "a"), 0)).toThrow('PlayModel: duplicate line id "lb"');
  });

  it("消した選手を戻すとき、同じ id の選手が既にあると throw する", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("b");
    model.addPlayer(player("b"));

    expect(() => model.restorePlayer(removal)).toThrow(
      'PlayModel.restorePlayer: duplicate player id "b"',
    );
  });
});

describe("PlayModel.removePlayer / restorePlayer", () => {
  it("選手を消すと、その選手から出る線も消え、戻すための選手、線と位置を返す", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const removal = model.removePlayer("a");

    expect(removal.index).toBe(0);
    expect(removal.player).toEqual(player("a"));
    expect(removal.removedLines.map((r) => [r.line.id, r.index])).toEqual([
      ["la", 0],
      ["lc", 2],
    ]);
    expect(model.getData().players.map((p) => p.id)).toEqual(["b", "c"]);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["lb"]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("消した選手を戻すと、選手とその選手から出る線が元の並びに戻り、1 回だけ通知する", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("a");
    const listener = vi.fn();
    model.onDidChange(listener);

    model.restorePlayer(removal);

    expect(model.getData()).toEqual(seed());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("線の出ていない選手を消しても、線は消えない", () => {
    const model = new PlayModel(seed());

    const removal = model.removePlayer("c");

    expect(removal.removedLines).toEqual([]);
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);
  });

  it("線の出ていない選手を消して戻すと、元の並びに戻る", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("c");

    model.restorePlayer(removal);

    expect(model.getData()).toEqual(seed());
  });

  it("無い id の選手を消そうとすると throw する", () => {
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

  it("複数の選手をまとめて消すと、それぞれの選手から出る線も消え、1 回だけ通知する", () => {
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

  it("無い id が混じっていると、先に並んだ選手も消さずに throw し、通知もしない", () => {
    const model = new PlayModel(seed());
    const before = model.getSnapshot();
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.removePlayers(["a", "ghost"])).toThrow(
      'PlayModel.removePlayers: unknown or repeated player id "ghost"',
    );

    expect(model.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("同じ id が 2 度あると、1 人も消さずに throw する", () => {
    const model = new PlayModel(seed());
    const before = model.getSnapshot();

    expect(() => model.removePlayers(["a", "a"])).toThrow(
      'PlayModel.removePlayers: unknown or repeated player id "a"',
    );

    expect(model.getSnapshot()).toBe(before);
  });
});

describe("PlayModel の件数の上限", () => {
  function players(count: number, prefix = "p"): Player[] {
    return Array.from({ length: count }, (_, i) => player(`${prefix}${i}`));
  }

  function lines(count: number): Line[] {
    return Array.from({ length: count }, (_, i) => line(`l${i}`, "p0"));
  }

  function waypoints(count: number): FieldPosition[] {
    return Array.from({ length: count }, (_, i) => ({ lateralYard: i, downfieldYard: 5 }));
  }

  it("選手はちょうど MAX_PLAYERS 人まで足せる", () => {
    const model = new PlayModel();

    model.addPlayers(players(MAX_PLAYERS));

    expect(model.getSnapshot().players).toHaveLength(MAX_PLAYERS);
  });

  it("MAX_PLAYERS 人を超える追加は、1 人も足さずに throw する", () => {
    const model = new PlayModel();
    model.addPlayers(players(MAX_PLAYERS - 1));
    const before = model.getSnapshot();

    expect(() => model.addPlayers(players(2, "q"))).toThrow(
      `PlayModel: too many players: ${MAX_PLAYERS + 1} > ${MAX_PLAYERS}`,
    );

    expect(model.getSnapshot()).toBe(before);
  });

  it("上限に達しているときに選手を戻すと throw する", () => {
    const model = new PlayModel({ ...seed(), players: [player("a")], lines: [] });
    const removal = model.removePlayer("a");
    model.addPlayers(players(MAX_PLAYERS));

    expect(() => model.restorePlayer(removal)).toThrow("PlayModel: too many players");
  });

  it("選手を戻すと従属線で MAX_LINES 本を超えるときは throw する", () => {
    const model = new PlayModel({
      ...seed(),
      players: [player("a"), player("p0")],
      lines: [line("la", "a")],
    });
    const removal = model.removePlayer("a");
    for (const l of lines(MAX_LINES)) {
      model.addLine(l);
    }

    expect(() => model.restorePlayer(removal)).toThrow("PlayModel: too many lines");
  });

  it("線はちょうど MAX_LINES 本まで足せる", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [] });

    for (const l of lines(MAX_LINES)) {
      model.addLine(l);
    }

    expect(model.getSnapshot().lines).toHaveLength(MAX_LINES);
  });

  it("MAX_LINES 本を超える線の追加は throw する", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [] });
    for (const l of lines(MAX_LINES)) {
      model.addLine(l);
    }

    expect(() => model.addLine(line("extra", "p0"))).toThrow("PlayModel: too many lines");
  });

  it("waypoint が MAX_WAYPOINTS_PER_LINE 個を超える線を足すと throw する", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [] });

    expect(() =>
      model.addLine({ ...line("x", "p0"), waypoints: waypoints(MAX_WAYPOINTS_PER_LINE + 1) }),
    ).toThrow("PlayModel: too many waypoints");
  });

  it("waypoint が MAX_WAYPOINTS_PER_LINE 個を超える線に差し替えると throw する", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [line("l", "p0")] });

    expect(() =>
      model.updateLine({ ...line("l", "p0"), waypoints: waypoints(MAX_WAYPOINTS_PER_LINE + 1) }),
    ).toThrow("PlayModel: too many waypoints");
  });

  it("waypoint がちょうど MAX_WAYPOINTS_PER_LINE 個の線は差し替えられる", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [line("l", "p0")] });

    model.updateLine({ ...line("l", "p0"), waypoints: waypoints(MAX_WAYPOINTS_PER_LINE) });

    expect(model.findLine("l")?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
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

  it("線を位置を指定して差し込むと、その位置に並ぶ", () => {
    const model = new PlayModel({ ...seed(), lines: [line("x", "a"), line("y", "b")] });

    model.insertLine(line("mid", "c"), 1);

    expect(model.getData().lines.map((l) => l.id)).toEqual(["x", "mid", "y"]);
  });

  it("線を範囲外の位置に差し込むと、近いほうの端に並ぶ", () => {
    const model = new PlayModel({ ...seed(), lines: [line("x", "a"), line("y", "b")] });

    model.insertLine(line("head", "c"), -5);
    model.insertLine(line("tail", "c"), 999);

    expect(model.getData().lines.map((l) => l.id)).toEqual(["head", "x", "y", "tail"]);
  });

  it("線を消すと、戻すための線と位置を返して、1 回だけ通知する", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    const removal = model.removeLine("lb");

    expect(removal).toEqual({ line: line("lb", "b"), index: 1 });
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lc"]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("無い id の線を消そうとすると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.removeLine("ghost")).toThrow(/unknown line id "ghost"/);
  });

  it("線を更新すると同じ id を差し替え、差し替え前の線を返す", () => {
    const model = new PlayModel(seed());

    const prev = model.updateLine({ ...line("lb", "b"), kind: "motion" });

    expect(prev).toEqual(line("lb", "b"));
    expect(model.findLine("lb")?.kind).toBe("motion");
    expect(model.findLine("la")?.kind).toBe("route");
  });

  it("無い id の線を差し替えようとすると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.updateLine(line("ghost", "a"))).toThrow(/unknown line id "ghost"/);
  });

  it("無い id の線を引くと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.getLine("ghost")).toThrow(/unknown line id "ghost"/);
  });
});

describe("PlayModel の発火", () => {
  it("通知には、変更後に読み取れるものと同じ図を渡す", () => {
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
