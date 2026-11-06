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
  name: "Test formation",
  side: "offense",
  players: [{ position: { lateralYard: 30, downfieldYard: -5 }, shape: "circle", label: "B" }],
};

const pair: Formation = {
  id: "pair",
  name: "Pair",
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

/** A formation from untyped external JSON whose only player has no position. */
function brokenFormation(): Formation {
  return JSON.parse('{ "players": [{ "shape": "circle" }] }');
}

describe("Reloading a diagram", () => {
  it("disables Undo of earlier edits after a reload", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");

    play.session.setPlayData(initialData());

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("replaces the diagram with the loaded one on reload", () => {
    const play = openPlay(initialData());
    play.session.setFieldZone("redzone");

    play.session.setPlayData(initialData());

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("fires onDidReset once on reload", () => {
    const play = openPlay(initialData());
    const reset = vi.fn();
    play.session.onDidReset(reset);

    play.session.setPlayData(initialData());

    expect(reset).toHaveBeenCalledOnce();
  });

  it("notifies the scene and the view state once each after onDidReset on reload", () => {
    const play = openPlay(initialData());
    const order: string[] = [];
    play.session.onDidReset(() => order.push("reset"));
    play.notified.mockImplementation((kind) => order.push(kind));

    play.session.setPlayData(initialData());

    expect(order).toEqual(["reset", "scene", "view"]);
  });

  it("notifies subscriptions made before the reload about edits after the reload", () => {
    const play = openPlay(initialData());
    play.session.setPlayData(initialData());
    play.notified.mockClear();

    play.session.setFieldZone("redzone");

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });

  it("still moves a player by dragging after a reload", () => {
    const play = openPlay(initialData());
    play.session.setPlayData(initialData());

    play.drag(yd(10, 0), yd(12, 3));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(12, 3));
  });

  it("neither calls onChange nor changes the diagram when a stale controller edits", () => {
    const play = openPlay(initialData());
    const stale = play.editor;
    play.session.setPlayData(initialData());

    stale.setFieldZone("redzone");

    expect(play.onChange).not.toHaveBeenCalled();
    expect(play.session.fieldZone).toBe("middle");
  });

  it("loads broken data as the default diagram", () => {
    const play = openPlay("not a play");

    expect(play.session.getPlayData()).toEqual(playData());
  });
});

describe("Loading a formation", () => {
  it("appends the formation's players to the current diagram", () => {
    const play = openPlay(initialData());

    play.session.loadFormation(formation);

    expect(play.session.getPlayData().players.map((p) => p.label)).toEqual(["a", "B"]);
  });

  it("calls onChange once because loading a formation is an edit", () => {
    const play = openPlay(initialData());

    play.session.loadFormation(formation);

    expect(play.onChange).toHaveBeenCalledOnce();
  });

  it("returns true when the formation's players are placed", () => {
    const play = openPlay(initialData());

    const loaded = play.session.loadFormation(formation);

    expect(loaded).toBe(true);
  });

  it("returns false for a formation with no player that can be placed", () => {
    const play = openPlay(initialData());

    const loaded = play.session.loadFormation(brokenFormation());

    expect(loaded).toBe(false);
  });

  it("keeps the diagram and history and skips onChange when no player can be placed", () => {
    const play = openPlay(initialData());

    play.session.loadFormation(brokenFormation());

    expect(play.session.getPlayData()).toEqual(initialData());
    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.onChange).not.toHaveBeenCalled();
  });

  it("assigns the formation's players ids that do not collide with existing players", () => {
    const play = openPlay(playData([player("player-1", 10, 0)]));

    play.session.loadFormation(pair);

    const ids = play.session.getPlayData().players.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps the position, shape, label, and color of the formation's players", () => {
    const play = openPlay(playData());

    play.session.loadFormation(pair);

    expect(play.session.getPlayData().players).toEqual([
      { id: "player-1", ...pair.players[0] },
      { id: "player-2", ...pair.players[1] },
    ]);
  });

  it("clears the selection on load", () => {
    const play = openPlay(initialData());
    play.click(yd(10, 0));

    play.session.loadFormation(formation);

    expect(play.editor.getViewState().selection).toEqual({ kind: "none" });
  });

  it("stops the drawing in progress on load", () => {
    const play = openPlay(initialData());
    play.startLine(yd(10, 0));

    play.session.loadFormation(formation);

    expect(play.editor.getViewState().isDrawing).toBe(false);
  });

  it("removes only the formation's players when Undo follows the load", () => {
    const play = openPlay(initialData());
    play.session.loadFormation(pair);

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(initialData());
  });

  it("places no player and records no history when the load would exceed MAX_PLAYERS", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS - 1)));

    play.session.loadFormation(pair);

    expect(play.session.getPlayData().players).toHaveLength(MAX_PLAYERS - 1);
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("returns false when the load would exceed MAX_PLAYERS", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS - 1)));

    const loaded = play.session.loadFormation(pair);

    expect(loaded).toBe(false);
  });

  it("places a formation that brings the count to exactly MAX_PLAYERS", () => {
    const play = openPlay(playData(manyPlayers(MAX_PLAYERS - 2)));

    play.session.loadFormation(pair);

    expect(play.session.getPlayData().players).toHaveLength(MAX_PLAYERS);
  });
});
