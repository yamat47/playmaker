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

describe("PlayModel construction", () => {
  it("holds an empty diagram when created without one", () => {
    const model = new PlayModel();

    expect(model.getData()).toEqual({
      version: 2,
      field: { zone: "middle", losYard: 50 },
      players: [],
      lines: [],
    });
  });

  it("keeps its diagram when the input is modified after construction", () => {
    const input = mutable(seed());
    const model = new PlayModel(input);

    must(input.players[0]).label = "tampered";

    expect(model.findPlayer("a")?.label).toBe("a");
  });

  it("migrates an unversioned legacy diagram to the current version", () => {
    // Data saved in the v1 shape without a version.
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

describe("PlayModel unknown ids", () => {
  it("throws when adding a line whose start player does not exist, without changing it", () => {
    const model = new PlayModel(seed());

    expect(() => model.addLine(line("lz", "z"))).toThrow('PlayModel: unknown start player id "z"');
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);
  });

  it("throws when updating a player with an unknown id", () => {
    const model = new PlayModel(seed());

    expect(() => model.updatePlayer(player("ghost"))).toThrow(/unknown player id "ghost"/);
  });

  it("throws when getting a player with an unknown id", () => {
    const model = new PlayModel(seed());

    expect(() => model.getPlayer("ghost")).toThrow(/unknown player id "ghost"/);
  });

  it("throws when removing a player with an unknown id", () => {
    const model = new PlayModel(seed());

    expect(() => model.removePlayer("ghost")).toThrow(/unknown player id "ghost"/);
  });

  it("throws when removing a line with an unknown id", () => {
    const model = new PlayModel(seed());

    expect(() => model.removeLine("ghost")).toThrow(/unknown line id "ghost"/);
  });

  it("throws when updating a line with an unknown id", () => {
    const model = new PlayModel(seed());

    expect(() => model.updateLine(line("ghost", "a"))).toThrow(/unknown line id "ghost"/);
  });

  it("throws when getting a line with an unknown id", () => {
    const model = new PlayModel(seed());

    expect(() => model.getLine("ghost")).toThrow(/unknown line id "ghost"/);
  });
});

describe("PlayModel duplicate id rejection", () => {
  it("throws when adding a player with an existing id, without changing or notifying", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.addPlayer(player("a"))).toThrow('duplicate player id "a"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("throws without adding the earlier players when a batch contains an existing id", () => {
    const model = new PlayModel(seed());
    const listener = vi.fn();
    model.onDidChange(listener);

    expect(() => model.addPlayers([player("d"), player("b")])).toThrow('duplicate player id "b"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("throws when a batch of players repeats an id", () => {
    const model = new PlayModel(seed());

    expect(() => model.addPlayers([player("d"), player("d")])).toThrow('duplicate player id "d"');
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("throws when adding a line with an existing id", () => {
    const model = new PlayModel(seed());

    expect(() => model.addLine(line("la", "b"))).toThrow('duplicate line id "la"');
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);
  });

  it("throws when inserting a line with an existing id at an index", () => {
    const model = new PlayModel(seed());

    expect(() => model.insertLine(line("lb", "a"), 0)).toThrow('PlayModel: duplicate line id "lb"');
  });

  it("throws when restoring a removed player whose id already exists", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("b");
    model.addPlayer(player("b"));

    expect(() => model.restorePlayer(removal)).toThrow(
      'PlayModel.restorePlayer: duplicate player id "b"',
    );
  });
});

describe("PlayModel indexes", () => {
  it("throws when inserting a line at a negative index or past the line count", () => {
    const model = new PlayModel(seed());

    expect(() => model.insertLine(line("ld", "a"), 4)).toThrow(
      "PlayModel: line index out of range: 4 (0..3)",
    );
    expect(() => model.insertLine(line("ld", "a"), -1)).toThrow("line index out of range");
    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc"]);
  });

  it("inserts a line at the end when the index equals the line count", () => {
    const model = new PlayModel(seed());

    model.insertLine(line("ld", "a"), 3);

    expect(model.getData().lines.map((l) => l.id)).toEqual(["la", "lb", "lc", "ld"]);
  });

  it("throws without restoring when the removal's player index is out of range", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("b");

    expect(() => model.restorePlayer({ ...removal, index: 3 })).toThrow(
      "PlayModel: player index out of range: 3 (0..2)",
    );
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("throws without restoring when the removal's line index is out of range", () => {
    const model = new PlayModel(seed());
    const removal = model.removePlayer("b");
    const removedLines = removal.removedLines.map((r) => ({ ...r, index: 5 }));

    expect(() => model.restorePlayer({ ...removal, removedLines })).toThrow(
      "PlayModel: line index out of range: 5 (0..2)",
    );
    expect(model.getData().players.map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("PlayModel batch removal", () => {
  it("throws without removing or notifying when the ids include an unknown one", () => {
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

  it("throws without removing anyone when an id is repeated", () => {
    const model = new PlayModel(seed());
    const before = model.getSnapshot();

    expect(() => model.removePlayers(["a", "a"])).toThrow(
      'PlayModel.removePlayers: unknown or repeated player id "a"',
    );

    expect(model.getSnapshot()).toBe(before);
  });
});

describe("PlayModel limits", () => {
  function players(count: number, prefix = "p"): Player[] {
    return Array.from({ length: count }, (_, i) => player(`${prefix}${i}`));
  }

  function lines(count: number): Line[] {
    return Array.from({ length: count }, (_, i) => line(`l${i}`, "p0"));
  }

  function waypoints(count: number): FieldPosition[] {
    return Array.from({ length: count }, (_, i) => ({ lateralYard: i, downfieldYard: 5 }));
  }

  it("accepts exactly MAX_PLAYERS players", () => {
    const model = new PlayModel();

    model.addPlayers(players(MAX_PLAYERS));

    expect(model.getSnapshot().players).toHaveLength(MAX_PLAYERS);
  });

  it("throws without adding anyone when the players would exceed MAX_PLAYERS", () => {
    const model = new PlayModel();
    model.addPlayers(players(MAX_PLAYERS - 1));
    const before = model.getSnapshot();

    expect(() => model.addPlayers(players(2, "q"))).toThrow(
      `PlayModel: too many players: ${MAX_PLAYERS + 1} > ${MAX_PLAYERS}`,
    );

    expect(model.getSnapshot()).toBe(before);
  });

  it("throws when restoring a player at the limit", () => {
    const model = new PlayModel({ ...seed(), players: [player("a")], lines: [] });
    const removal = model.removePlayer("a");
    model.addPlayers(players(MAX_PLAYERS));

    expect(() => model.restorePlayer(removal)).toThrow("PlayModel: too many players");
  });

  it("throws when restoring a player whose lines would exceed MAX_LINES", () => {
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

  it("accepts exactly MAX_LINES lines", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [] });

    for (const l of lines(MAX_LINES)) {
      model.addLine(l);
    }

    expect(model.getSnapshot().lines).toHaveLength(MAX_LINES);
  });

  it("throws when adding a line beyond MAX_LINES", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: lines(MAX_LINES) });

    expect(() => model.addLine(line("extra", "p0"))).toThrow("PlayModel: too many lines");
  });

  it("throws when adding a line with more than MAX_WAYPOINTS_PER_LINE waypoints", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [] });

    expect(() =>
      model.addLine({ ...line("x", "p0"), waypoints: waypoints(MAX_WAYPOINTS_PER_LINE + 1) }),
    ).toThrow("PlayModel: too many waypoints");
  });

  it("throws when updating a line to more than MAX_WAYPOINTS_PER_LINE waypoints", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [line("l", "p0")] });

    expect(() =>
      model.updateLine({ ...line("l", "p0"), waypoints: waypoints(MAX_WAYPOINTS_PER_LINE + 1) }),
    ).toThrow("PlayModel: too many waypoints");
  });

  it("updates a line with exactly MAX_WAYPOINTS_PER_LINE waypoints", () => {
    const model = new PlayModel({ ...seed(), players: [player("p0")], lines: [line("l", "p0")] });

    model.updateLine({ ...line("l", "p0"), waypoints: waypoints(MAX_WAYPOINTS_PER_LINE) });

    expect(model.findLine("l")?.waypoints).toHaveLength(MAX_WAYPOINTS_PER_LINE);
  });
});
