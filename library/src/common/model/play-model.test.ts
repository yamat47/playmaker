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

describe("PlayModel の未知の id", () => {
  it("無い id の選手を差し替えようとすると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.updatePlayer(player("ghost"))).toThrow(/unknown player id "ghost"/);
  });

  it("無い id の選手を引くと throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.getPlayer("ghost")).toThrow(/unknown player id "ghost"/);
  });

  it("無い id の選手を消そうとすると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.removePlayer("ghost")).toThrow(/unknown player id "ghost"/);
  });

  it("無い id の線を消そうとすると throw する", () => {
    const model = new PlayModel(seed());

    expect(() => model.removeLine("ghost")).toThrow(/unknown line id "ghost"/);
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

describe("PlayModel の一括削除", () => {
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
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: lines(MAX_LINES) });

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
