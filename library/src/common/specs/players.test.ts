import { describe, expect, it, vi } from "vitest";
import {
  line,
  manyPlayers,
  playData,
  player,
  positionOf,
  twoPlayersWithRoute,
} from "../../test-support/fixtures.js";
import { openPlay, yd } from "../../test-support/play-driver.js";
import type { PlayData } from "../model/play-data.js";
import { MAX_PLAYERS } from "../model/player.js";

function withPlayers(count: number): PlayData {
  return playData(manyPlayers(count));
}

/** A diagram with player a selected. */
function openWithASelected() {
  const play = openPlay(twoPlayersWithRoute());
  play.click(yd(10, 0));
  return play;
}

describe("Adding a player", () => {
  it("adds an unlabeled circle player where the add-player tool clicks empty space", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.session.getPlayData().players).toEqual([
      { id: "player-1", position: yd(30, -5), shape: "circle", label: "" },
    ]);
  });

  it("selects the added player", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "player-1" });
  });

  it("selects a player pressed with the add-player tool instead of stacking a new one on it", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");

    play.click(yd(10, 0));

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "a" });
  });

  it("places a player at the end of the selected line rather than grabbing its handle", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(25, 5));
    play.editor.setTool("add-player");

    play.click(yd(25, 5));

    expect(positionOf(play.session.getPlayData(), "player-1")).toEqual(yd(25, 5));
    expect(play.session.getPlayData().lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("moves a player dragged with the add-player tool and keeps the tool", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");

    play.drag(yd(10, 0), yd(14, 3));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(14, 3));
    expect(play.editor.getViewState().tool).toBe("add-player");
  });

  it("gives a new player the shape, color, and fill last chosen in the panel", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.editor.updateSelectedPlayer({ shape: "square", color: "#d32f2f", fill: "solid" });
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.editor.getSelectedPlayer()).toMatchObject({
      shape: "square",
      color: "#d32f2f",
      fill: "solid",
    });
  });

  it("gives a new player the default color and fill again once the panel resets them", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.editor.updateSelectedPlayer({ shape: "square", color: "#d32f2f", fill: "solid" });
    play.editor.updateSelectedPlayer({ color: null, fill: null });
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.editor.getSelectedPlayer()).toEqual({
      id: "player-1",
      position: yd(30, -5),
      shape: "square",
      label: "",
    });
  });

  it("keeps the remembered style when only a label is edited afterward", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(10, 0));
    play.editor.updateSelectedPlayer({ fill: "solid" });
    play.click(yd(20, 0));
    play.editor.updateSelectedPlayer({ label: "QB" });
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    expect(play.editor.getSelectedPlayer()?.fill).toBe("solid");
  });

  it("assigns the added player an id that does not collide with existing players", () => {
    const play = openPlay(playData([player("player-1", 10, 0)]));
    play.editor.setTool("add-player");

    play.click(yd(30, -5));

    const ids = play.session.getPlayData().players.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("places the player at the window edge when clicked outside the zone window", () => {
    const play = openPlay(playData());
    play.editor.setTool("add-player");

    play.click(yd(30, -50));

    expect(play.session.getPlayData().players[0]?.position).toEqual(yd(30, -15));
  });

  it("removes the added player when Undo follows the add", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");
    play.click(yd(30, -5));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("neither adds a player nor records history on click when MAX_PLAYERS players exist", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS));
    play.editor.setTool("add-player");

    play.click(yd(30, 5));

    expect(play.session.getPlayData().players).toHaveLength(MAX_PLAYERS);
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("reports 0 remaining player slots when MAX_PLAYERS players exist", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS));

    expect(play.editor.getViewState().remainingPlayerSlots).toBe(0);
  });

  it("reports 0 remaining player slots once the last player is added", () => {
    const play = openPlay(withPlayers(MAX_PLAYERS - 1));
    play.editor.setTool("add-player");

    play.click(yd(30, 5));

    expect(play.editor.getViewState().remainingPlayerSlots).toBe(0);
  });
});

describe("Dragging a player", () => {
  it("draws a player grabbed off center with the grab offset kept while moving", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10.5, 0.25));
    play.editor.pointerMove(yd(14.5, 3.25));

    expect(positionOf(play.editor.getFrame().scene, "a")).toEqual(yd(14, 3));
  });

  it("places a player grabbed off center with the grab offset kept on release", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10.5, 0.25), yd(14.5, 3.25));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(14, 3));
  });

  it("moves the lines that start at a dragged player by the same distance", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(12, 1));

    expect(play.session.getPlayData().lines[0]).toMatchObject({
      waypoints: [yd(17, 3)],
      end: yd(27, 6),
    });
  });

  it("leaves the lines of other players where they are when a player is dragged", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(20, 0), yd(22, 1));

    expect(play.session.getPlayData().lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("draws the lines moving along with the player while it is dragged", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 1));

    expect(play.editor.getFrame().scene.lines[0]?.end).toEqual(yd(27, 6));
  });

  it("passes the moved diagram exactly once when a player and its lines are dragged", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(12, 1));

    expect(play.onChange).toHaveBeenCalledExactlyOnceWith(play.session.getPlayData());
  });

  it("draws the player moving alone while Option or Alt is held", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 1), { altKey: true });

    const { scene } = play.editor.getFrame();
    expect(positionOf(scene, "a")).toEqual(yd(12, 1));
    expect(scene.lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("moves the player alone when Option or Alt is held during the drag", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(12, 1), { altKey: true });

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(12, 1));
    expect(play.session.getPlayData().lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("takes the lines along when Option or Alt is let go before the release", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 1), { altKey: true });
    play.editor.pointerMove(yd(12, 1), { altKey: false });

    play.editor.pointerUp(yd(12, 1));

    expect(play.session.getPlayData().lines[0]?.end).toEqual(yd(27, 6));
  });

  it("does not redraw while a dragged player stays on the same grid point", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(12, 1));
    play.notified.mockClear();

    play.editor.pointerMove(yd(12.1, 1.1));

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("keeps each moved line point inside the zone window", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(10, 12));

    expect(play.session.getPlayData().lines[0]).toMatchObject({
      waypoints: [yd(15, 14)],
      end: yd(25, 15),
    });
  });

  it("puts the player and its lines back together on Undo", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.drag(yd(10, 0), yd(12, 1));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not record history when released without moving", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.click(yd(10, 0));

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("stops the drawn player at the window edge when moved outside the zone window", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerDown(yd(10, 0));
    play.editor.pointerMove(yd(10, -30));

    expect(positionOf(play.editor.getFrame().scene, "a")).toEqual(yd(10, -15));
  });

  it("snaps the player to the window edge when released outside the zone window", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.drag(yd(10, 0), yd(-5, 30));

    expect(positionOf(play.session.getPlayData(), "a")).toEqual(yd(0, 15));
  });

  it("does not move a player outside the window to the edge when it is only clicked", () => {
    const play = openPlay(playData([player("far", 10, 16)]));

    play.click(yd(10, 16));

    expect(positionOf(play.session.getPlayData(), "far")).toEqual(yd(10, 16));
  });

  it("does not notify when the pointer moves and releases without a press", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.pointerMove(yd(10, 0));
    play.editor.pointerUp(yd(10, 0));

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("records only the deletion when the player is deleted mid-drag and then released", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.pointerDown(yd(10, 0));
    play.editor.deleteSelection();
    play.editor.pointerMove(yd(14, 4));
    play.editor.pointerUp(yd(14, 4));

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("moves only the player drawn on top when players with the same id overlap", () => {
    const play = openPlay(
      playData([
        { ...player("p", 10, 0), label: "bottom" },
        { ...player("p", 10, 0), label: "top" },
      ]),
    );

    play.drag(yd(10, 0), yd(14, 0));

    const moved = play.session.getPlayData().players.map((p) => [p.label, p.position]);
    expect(moved).toEqual([
      ["bottom", yd(10, 0)],
      ["top", yd(14, 0)],
    ]);
  });
});

describe("Deleting a player", () => {
  it("removes the lines starting from a player when the player is deleted", () => {
    const play = openWithASelected();

    play.editor.deleteSelection();

    expect(play.session.getPlayData()).toEqual(playData([player("b", 20, 0)]));
  });

  it("calls onChange only once when a player and its lines are removed together", () => {
    const play = openWithASelected();

    play.editor.deleteSelection();

    expect(play.onChange).toHaveBeenCalledOnce();
  });

  it("restores the player and lines in their original order when the deletion is undone", () => {
    const play = openWithASelected();
    play.editor.deleteSelection();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("restores the line order on Undo for a player whose two lines flank another's line", () => {
    const data = playData(
      [player("a", 10, 0), player("b", 20, 0)],
      [line("la", "a"), line("lb", "b"), line("lc", "a")],
    );
    const play = openPlay(data);
    play.click(yd(10, 0));
    play.editor.deleteSelection();

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(data);
  });

  it("removes the player and lines again when Redo follows undoing the deletion", () => {
    const play = openWithASelected();
    play.editor.deleteSelection();
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData()).toEqual(playData([player("b", 20, 0)]));
  });
});

describe("Editing player values", () => {
  it("changes the label, shape, color, and fill of the selected player", () => {
    const play = openWithASelected();

    play.editor.updateSelectedPlayer({
      label: "QB",
      shape: "square",
      color: "#ff0000",
      fill: "solid",
    });

    expect(play.session.getPlayData().players[0]).toEqual({
      ...player("a", 10, 0),
      label: "QB",
      shape: "square",
      color: "#ff0000",
      fill: "solid",
    });
  });

  it("returns to a default player without color or fill when both receive null", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ color: "#ff0000", fill: "solid" });

    play.editor.updateSelectedPlayer({ color: null, fill: null });

    expect(play.session.getPlayData().players[0]).toEqual(player("a", 10, 0));
  });

  it("restores the previous values when Undo follows the change", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ label: "QB" });

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("applies the original values on Redo even if the passed patch is mutated later", () => {
    const play = openWithASelected();
    const patch = { label: "QB" };
    play.editor.updateSelectedPlayer(patch);
    patch.label = "RB";
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("does not change player values while a line is selected", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.click(yd(25, 5));

    play.editor.updateSelectedPlayer({ label: "QB" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not change player values while nothing is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.updateSelectedPlayer({ label: "QB" });

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("does not record history when changing values after the selected player vanished", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("add-player");
    play.click(yd(30, -5));
    play.editor.undo();

    play.editor.updateSelectedPlayer({ label: "QB" });

    expect(play.editor.getViewState().canRedo).toBe(true);
  });

  it("neither records history nor notifies when only the current values are passed", () => {
    const play = openWithASelected();
    play.notified.mockClear();

    play.editor.updateSelectedPlayer({ label: "a", shape: "circle" });

    expect(play.editor.getViewState().canUndo).toBe(false);
    expect(play.notified).not.toHaveBeenCalled();
  });

  it("does not record history when a player without color receives a null color", () => {
    const play = openWithASelected();

    play.editor.updateSelectedPlayer({ color: null });

    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("notifies the view state when player values change even if the state is unchanged", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ label: "QB" });
    play.notified.mockClear();

    play.editor.updateSelectedPlayer({ label: "RB" });

    expect(play.notified.mock.calls).toEqual([["scene"], ["view"]]);
  });
});

describe("Editing a label", () => {
  it("shows the typed label on the selected player before it is committed", () => {
    const play = openWithASelected();

    play.editor.previewLabel("QB");

    expect(play.editor.getFrame().scene.players[0]?.label).toBe("QB");
    expect(play.session.getPlayData().players[0]?.label).toBe("a");
  });

  it("commits a label typed in several steps as one edit that one Undo takes back", () => {
    const play = openWithASelected();
    play.editor.previewLabel("Q");
    play.editor.previewLabel("QB");
    play.editor.updateSelectedPlayer({ label: "QB" });

    play.editor.undo();

    expect(play.session.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("drops the typed label when the typing is discarded", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.editor.discardLabelDraft();

    expect(play.editor.getFrame().scene.players[0]?.label).toBe("a");
    expect(play.editor.getViewState().canUndo).toBe(false);
  });

  it("does not notify when nothing typed is discarded", () => {
    const play = openWithASelected();
    play.notified.mockClear();

    play.editor.discardLabelDraft();

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("keeps the typed label when a panel button changes the player before the label is committed", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.editor.updateSelectedPlayer({ shape: "square" });

    expect(play.session.getPlayData().players[0]).toMatchObject({ label: "QB", shape: "square" });
  });

  it("commits the typed label before another player is pressed", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.click(yd(20, 0));

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("commits the typed label before the tool changes", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.editor.setTool("route");

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("commits the typed label before what is in progress is canceled", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.editor.cancelInteraction();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("commits the typed label before Esc clears the selection", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.editor.stepBack();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("offers Undo for the typing while a label is typed, even with nothing committed before", () => {
    const play = openWithASelected();

    play.editor.previewLabel("QB");

    expect(play.editor.getViewState()).toMatchObject({ canUndo: true, isTypingLabel: true });
  });

  it("offers no Redo while a label is typed, since committing it ends what can be redone", () => {
    const play = openWithASelected();
    play.editor.updateSelectedPlayer({ shape: "square" });
    play.editor.undo();

    play.editor.previewLabel("QB");

    expect(play.editor.getViewState().canRedo).toBe(false);
  });

  it("takes back the typed label with Undo and brings it back with Redo", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");
    play.editor.undo();

    play.editor.redo();

    expect(play.session.getPlayData().players[0]?.label).toBe("QB");
  });

  it("keeps showing the typed label while the pointer moves over the field", () => {
    const play = openWithASelected();
    play.editor.previewLabel("QB");

    play.editor.pointerMove(yd(30, 5));

    expect(play.editor.getFrame().scene.players[0]?.label).toBe("QB");
  });

  it("ignores a typed label when no player is selected", () => {
    const play = openPlay(twoPlayersWithRoute());

    play.editor.previewLabel("QB");

    expect(play.notified).not.toHaveBeenCalled();
  });

  it("asks for the label when typing starts with a player selected", () => {
    const play = openWithASelected();
    const requested = vi.fn();
    play.editor.onDidRequestLabelEdit(requested);

    play.editor.requestLabelEdit();

    expect(requested).toHaveBeenCalledOnce();
  });

  it("leaves typing alone when no player is selected", () => {
    const play = openPlay(twoPlayersWithRoute());
    const requested = vi.fn();
    play.editor.onDidRequestLabelEdit(requested);

    play.editor.requestLabelEdit();

    expect(requested).not.toHaveBeenCalled();
  });

  it("selects a double-clicked player and asks for its label", () => {
    const play = openPlay(twoPlayersWithRoute());
    const requested = vi.fn();
    play.editor.onDidRequestLabelEdit(requested);

    play.editor.doubleClick(yd(20, 0));

    expect(requested).toHaveBeenCalledOnce();
    expect(play.editor.getViewState().selection).toEqual({ kind: "player", id: "b" });
  });

  it("asks for the label after the view state shows the player double-clicked with a line tool", () => {
    const play = openPlay(twoPlayersWithRoute());
    play.editor.setTool("route");
    play.click(yd(20, 0));
    play.click(yd(20, 0));
    play.notified.mockClear();
    const notifiedSoFar = vi.fn();
    play.editor.onDidRequestLabelEdit(() => notifiedSoFar([...play.notified.mock.calls]));

    play.editor.doubleClick(yd(20, 0));

    expect(notifiedSoFar).toHaveBeenCalledExactlyOnceWith([["scene"], ["view"]]);
  });

  it("asks for the label of a player double-clicked with a line tool instead of drawing", () => {
    const play = openPlay(twoPlayersWithRoute());
    const requested = vi.fn();
    play.editor.onDidRequestLabelEdit(requested);
    play.editor.setTool("route");
    play.click(yd(20, 0));
    play.click(yd(20, 0));

    play.editor.doubleClick(yd(20, 0));

    expect(requested).toHaveBeenCalledOnce();
    expect(play.editor.getViewState()).toMatchObject({
      isDrawing: false,
      selection: { kind: "player", id: "b" },
    });
  });

  it("asks for the label of a player double-clicked near the edge of its marker with a line tool", () => {
    const play = openPlay(twoPlayersWithRoute());
    const requested = vi.fn();
    play.editor.onDidRequestLabelEdit(requested);
    play.editor.setTool("route");
    play.click(yd(20.8, 0));
    play.click(yd(20.8, 0));

    play.editor.doubleClick(yd(20.8, 0));

    expect(requested).toHaveBeenCalledOnce();
    expect(play.session.getPlayData().lines).toEqual(twoPlayersWithRoute().lines);
  });

  it("does not ask for a label when empty space is double-clicked", () => {
    const play = openPlay(twoPlayersWithRoute());
    const requested = vi.fn();
    play.editor.onDidRequestLabelEdit(requested);

    play.editor.doubleClick(yd(40, -10));

    expect(requested).not.toHaveBeenCalled();
  });
});
