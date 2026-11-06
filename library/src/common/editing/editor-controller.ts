import type { Event } from "../base/event.js";
import { Disposable } from "../base/lifecycle.js";
import type { ICommand } from "../commands/command.js";
import type { ICommandService } from "../commands/command-service.js";
import { SetFieldZoneCommand } from "../commands/field-commands.js";
import { LoadFormationCommand } from "../commands/formation-commands.js";
import {
  AddLineCommand,
  type LinePatch,
  RemoveLineCommand,
  UpdateLineCommand,
} from "../commands/line-commands.js";
import {
  AddPlayerCommand,
  MovePlayerCommand,
  type PlayerPatch,
  RemovePlayerCommand,
  UpdatePlayerCommand,
} from "../commands/player-commands.js";
import { type Formation, instantiateFormation } from "../formations/formation.js";
import { clampToZoneWindow } from "../geometry/field.js";
import { snapToGrid } from "../geometry/grid.js";
import {
  hitLineHandle,
  hitTestLine,
  hitTestPlayer,
  type LineHandleHit,
  pointDistance,
} from "../geometry/hit-test.js";
import { stopShortOfPlayer } from "../geometry/line-end.js";
import type { IIdFactory } from "../model/id-factory.js";
import { type Line, type LineKind, MAX_LINES } from "../model/line.js";
import type { FieldZone } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import {
  DEFAULT_PLAYER_SHAPE,
  type FieldPosition,
  MAX_PLAYERS,
  PLAYER_RADIUS_YARDS,
  type Player,
} from "../model/player.js";
import {
  type EditorFrame,
  type EditorSelection,
  type EditorTool,
  type EditorViewState,
  type IEditorController,
  isLineTool,
  isSameSelection,
  isToolAvailable,
  NO_MODIFIERS,
  NO_SELECTION,
  type PointerModifiers,
} from "./editor.js";
import { EditorNotifier } from "./editor-notifier.js";
import {
  addDraftPoint,
  type DragInteraction,
  type DragTarget,
  type DrawInteraction,
  draftToLine,
  dragPatch,
  dragPosition,
  type Interaction,
  isSamePosition,
  splitDraftPoints,
  startDrag,
  startDrawing,
} from "./interaction.js";
import { composePreview, computeOverlay, lineHandles } from "./preview.js";

/**
 * Takes the tool, the selection, and gestures, and issues commands. It never writes to the
 * Model directly. An in-progress drag or drawing is not put into the Model but is overlaid by
 * getFrame, so neither the Model's onDidChange nor the history moves until the edit is committed.
 */
export class EditorController extends Disposable implements IEditorController {
  private readonly model: IPlayModel;
  private readonly commands: ICommandService;
  private readonly ids: IIdFactory;

  private readonly notifier: EditorNotifier;
  readonly onDidChangeScene: Event<void>;
  readonly onDidChangeViewState: Event<void>;

  private tool: EditorTool = "select";
  private selection: EditorSelection = NO_SELECTION;
  private interaction: Interaction | undefined;
  // An index into the waypoints of the selected line, set by pressing a waypoint so that Delete
  // removes that waypoint instead of the whole line. Any other press lets go of it.
  private pickedWaypoint: number | undefined;

  constructor(model: IPlayModel, commands: ICommandService, ids: IIdFactory) {
    super();
    this.model = model;
    this.commands = commands;
    this.ids = ids;
    this.notifier = this._register(
      new EditorNotifier(() => ({
        state: this.getViewState(),
        player: this.getSelectedPlayer(),
        line: this.getSelectedLine(),
      })),
    );
    this.onDidChangeScene = this.notifier.onDidChangeScene;
    this.onDidChangeViewState = this.notifier.onDidChangeViewState;
    // A drag or drawing clears itself before committing, so a change that arrives while one is in
    // progress came from elsewhere (Undo, a zone switch, a load, a deletion by key). Ending it here
    // means no drag or drawing ever sees its target change, and none needs to check for that.
    this._register(
      this.model.onDidChange(() => {
        this.setInteraction(undefined);
        this.notifier.markSceneChanged();
      }),
    );
  }

  getViewState(): EditorViewState {
    const { players, lines } = this.model.getSnapshot();
    const isDrawing = this.interaction?.type === "draw-line";
    return {
      tool: this.tool,
      selection: this.liveSelection(),
      // Undo while drawing removes the last placed point, or stops drawing when there is none.
      canUndo: this.commands.canUndo || isDrawing,
      canRedo: this.commands.canRedo,
      fieldZone: this.model.getFieldZone(),
      isDrawing,
      remainingPlayerSlots: MAX_PLAYERS - players.length,
      canStartLine: lines.length < MAX_LINES,
    };
  }

  getSelectedPlayer(): Player | undefined {
    const s = this.selection;
    return s.kind === "player" ? this.model.findPlayer(s.id) : undefined;
  }

  getSelectedLine(): Line | undefined {
    const s = this.selection;
    return s.kind === "line" ? this.model.findLine(s.id) : undefined;
  }

  getFrame(): EditorFrame {
    const scene = composePreview(this.model.getSnapshot(), this.interaction);
    return { scene, overlay: computeOverlay(scene, this.selection, this.livePickedWaypoint()) };
  }

  setTool(tool: EditorTool): void {
    if (tool === this.tool) {
      return;
    }
    this.notifier.batch(() => {
      this.tool = tool;
      this.setInteraction(undefined);
    });
  }

  pointerDown(pos: FieldPosition): void {
    this.notifier.batch(() => {
      this.setPickedWaypoint(undefined);
      const tool = this.tool;
      if (isLineTool(tool)) {
        this.drawLinePointerDown(pos, tool);
      } else if (tool === "add-player") {
        // A press on a player grabs it rather than stacking a new player that hides it. A handle
        // of the selected line is not grabbed, so a player can still be placed at a line's end.
        if (!this.grabPlayer(pos)) {
          this.addPlayerAt(pos);
        }
      } else {
        this.selectPointerDown(pos);
      }
    });
  }

  pointerMove(pos: FieldPosition, modifiers: PointerModifiers = NO_MODIFIERS): void {
    const interaction = this.interaction;
    if (interaction === undefined) {
      return;
    }
    this.notifier.batch(() =>
      this.setInteraction(
        interaction.type === "draw-line"
          ? { ...interaction, cursor: this.placeDraftPoint(interaction, pos) }
          : {
              ...interaction,
              current: this.placeDragged(interaction, pos),
              alone: modifiers.altKey,
            },
      ),
    );
  }

  pointerUp(pos: FieldPosition, modifiers: PointerModifiers = NO_MODIFIERS): void {
    const interaction = this.interaction;
    if (interaction?.type === "draw-line") {
      this.releaseDrawing(interaction, pos);
      return;
    }
    if (interaction?.type !== "drag") {
      return;
    }
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      const moved = dragPosition(interaction, pos);
      // Compare the position before snapping. Merely clicking a player that sits outside the window
      // must not move it to the window's edge.
      if (isSamePosition(moved, interaction.origin)) {
        return;
      }
      const to = this.placeDragged(interaction, pos);
      // A move that lands on the same grid point does not change the diagram, so it is put into
      // neither the history nor a notification.
      if (isSamePosition(to, interaction.origin)) {
        return;
      }
      this.commands.execute(this.dropCommand(interaction, to, modifiers.altKey));
    });
  }

  cancelInteraction(): void {
    this.notifier.batch(() => this.setInteraction(undefined));
  }

  doubleClick(pos: FieldPosition): void {
    if (this.interaction?.type === "draw-line") {
      this.commitLine();
      return;
    }
    const line = this.getSelectedLine();
    const hit =
      line === undefined
        ? undefined
        : hitLineHandle(lineHandles(this.model.getSnapshot(), line), pos);
    if (line !== undefined && hit?.kind === "waypoint") {
      this.notifier.batch(() => this.removeWaypoint(line, hit.index));
    }
  }

  stepBack(): void {
    this.notifier.batch(() => {
      if (this.interaction !== undefined) {
        this.setInteraction(undefined);
      } else if (this.livePickedWaypoint() !== undefined) {
        this.setPickedWaypoint(undefined);
      } else if (this.liveSelection().kind !== "none") {
        this.setSelection(NO_SELECTION);
      } else {
        this.setTool("select");
      }
    });
  }

  commitLine(): void {
    const interaction = this.interaction;
    if (interaction?.type !== "draw-line") {
      return;
    }
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      const line = this.lineFromDraft(interaction);
      if (line === undefined) {
        return;
      }
      this.commands.execute(new AddLineCommand(line));
      // The tool stays, because the lines of a play come in runs (all the blocks, all the routes),
      // and the drawn line is selected so the panel can adjust it before the next one starts.
      this.setSelection({ kind: "line", id: line.id });
    });
  }

  deleteSelection(): void {
    const player = this.getSelectedPlayer();
    const line = this.getSelectedLine();
    const picked = this.livePickedWaypoint();
    this.notifier.batch(() => {
      if (line !== undefined && picked !== undefined) {
        // The line stays selected, so the next Delete takes the line itself.
        this.removeWaypoint(line, picked);
        return;
      }
      if (player !== undefined) {
        this.commands.execute(new RemovePlayerCommand(player.id));
      } else if (line !== undefined) {
        this.commands.execute(new RemoveLineCommand(line.id));
      } else {
        return;
      }
      this.setSelection(NO_SELECTION);
    });
  }

  updateSelectedPlayer(patch: PlayerPatch): void {
    const player = this.getSelectedPlayer();
    if (player === undefined) {
      return;
    }
    this.notifier.batch(() => this.commands.execute(new UpdatePlayerCommand(player.id, patch)));
  }

  updateSelectedLine(patch: LinePatch): void {
    const line = this.getSelectedLine();
    if (line === undefined) {
      return;
    }
    this.notifier.batch(() => this.commands.execute(new UpdateLineCommand(line.id, patch)));
  }

  setFieldZone(zone: FieldZone): void {
    this.notifier.batch(() => this.commands.execute(new SetFieldZoneCommand(zone)));
  }

  /**
   * Appends the players to the existing diagram and returns true. Returns false without placing
   * anyone when they would exceed MAX_PLAYERS. PlaySession passes only normalized formations, and
   * those always have a player.
   */
  loadFormation(formation: Formation): boolean {
    const { players } = this.model.getSnapshot();
    if (formation.players.length > MAX_PLAYERS - players.length) {
      return false;
    }
    const added = instantiateFormation(
      formation,
      this.ids,
      players.map((p) => p.id),
    );
    this.notifier.batch(() => {
      this.commands.execute(new LoadFormationCommand(added));
      // After loading, the old selection means nothing, so clear it.
      this.setSelection(NO_SELECTION);
    });
    return true;
  }

  undo(): void {
    this.notifier.batch(() => {
      const interaction = this.interaction;
      if (interaction?.type === "draw-line") {
        this.setInteraction(
          interaction.points.length === 0
            ? undefined
            : { ...interaction, points: interaction.points.slice(0, -1) },
        );
        return;
      }
      this.setInteraction(undefined);
      this.commands.undo();
    });
  }

  redo(): void {
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      this.commands.redo();
    });
  }

  /** The selection, or none once its target has vanished. */
  private liveSelection(): EditorSelection {
    return this.getSelectedPlayer() === undefined && this.getSelectedLine() === undefined
      ? NO_SELECTION
      : this.selection;
  }

  private setSelection(next: EditorSelection): void {
    if (isSameSelection(this.selection, next)) {
      return;
    }
    this.selection = next;
    this.setPickedWaypoint(undefined);
    this.notifier.markSceneChanged();
  }

  /** The picked waypoint, or undefined once it or the selected line is gone. */
  private livePickedWaypoint(): number | undefined {
    const count = this.getSelectedLine()?.waypoints.length ?? 0;
    const picked = this.pickedWaypoint;
    return picked !== undefined && picked < count ? picked : undefined;
  }

  private setPickedWaypoint(next: number | undefined): void {
    if (next === this.pickedWaypoint) {
      return;
    }
    this.pickedWaypoint = next;
    this.notifier.markSceneChanged();
  }

  private removeWaypoint(line: Line, index: number): void {
    const waypoints = line.waypoints.filter((_, i) => i !== index);
    this.commands.execute(new UpdateLineCommand(line.id, { waypoints }));
    this.setPickedWaypoint(undefined);
  }

  private setInteraction(next: Interaction | undefined): void {
    if (next === this.interaction) {
      return;
    }
    this.interaction = next;
    this.notifier.markSceneChanged();
  }

  // Every window edge (the sidelines horizontally, whole yards from the LOS vertically) is a grid
  // point, so clamping and then rounding never leaves the window.
  private clampToField(pos: FieldPosition): FieldPosition {
    return snapToGrid(clampToZoneWindow(pos, this.model.getSnapshot().field));
  }

  /**
   * Where a point of the line being drawn goes. A point on another player stops just outside that
   * player's marker, whether it ends up a waypoint or the end.
   */
  private placeDraftPoint(draw: DrawInteraction, pos: FieldPosition): FieldPosition {
    return this.stopShort(
      this.clampToField(pos),
      draw.points.at(-1) ?? draw.start,
      draw.startPlayerId,
    );
  }

  /** Where the dragged target goes. A dragged end stops short of a player like a drawn one. */
  private placeDragged(drag: DragInteraction, pos: FieldPosition): FieldPosition {
    const at = this.clampToField(dragPosition(drag, pos));
    const { target } = drag;
    return target.kind === "endpoint" ? this.stopShort(at, target.from, target.startPlayerId) : at;
  }

  private stopShort(
    point: FieldPosition,
    from: FieldPosition,
    startPlayerId: string,
  ): FieldPosition {
    const others = this.model.getSnapshot().players.filter((p) => p.id !== startPlayerId);
    return stopShortOfPlayer(point, from, others);
  }

  private dropCommand(drag: DragInteraction, to: FieldPosition, alone: boolean): ICommand {
    const drop = dragPatch(drag.target, to, alone);
    return drop.kind === "player"
      ? new MovePlayerCommand(drop.player.id, to, drop.withLines)
      : new UpdateLineCommand(drop.lineId, drop.patch);
  }

  private lineFromDraft(draw: DrawInteraction): Line | undefined {
    const split = splitDraftPoints(draw.points);
    if (split === undefined) {
      return undefined;
    }
    const id = this.ids.next("line", new Set(this.model.getSnapshot().lines.map((l) => l.id)));
    return draftToLine(draw, id, split);
  }

  private selectPointerDown(pos: FieldPosition): void {
    if (!this.grabHandle(pos) && !this.grabPlayer(pos)) {
      this.selectLineAt(pos);
    }
  }

  private selectLineAt(pos: FieldPosition): void {
    const data = this.model.getSnapshot();
    const line = hitTestLine(data.lines, data.players, pos);
    this.setSelection(line === undefined ? NO_SELECTION : { kind: "line", id: line.id });
  }

  /**
   * Starts dragging the handle of the selected line under pos and returns true, or returns false
   * when there is none. The select tool tries this before anything else, so a handle can be
   * edited even when it overlaps a player or another line.
   */
  private grabHandle(pos: FieldPosition): boolean {
    const handle = this.hitSelectedLineHandle(pos);
    if (handle === undefined) {
      return false;
    }
    this.setInteraction(handle);
    if (handle.target.kind === "waypoint") {
      this.setPickedWaypoint(handle.target.index);
    }
    return true;
  }

  /**
   * Selects the player under pos and starts dragging it, returning true, or returns false when
   * there is none. Releasing without moving is just a selection.
   */
  private grabPlayer(pos: FieldPosition): boolean {
    const player = hitTestPlayer(this.model.getSnapshot().players, pos);
    if (player === undefined) {
      return false;
    }
    this.setSelection({ kind: "player", id: player.id });
    this.setInteraction(startDrag({ kind: "player", player }, player.position, pos));
    return true;
  }

  private hitSelectedLineHandle(pos: FieldPosition): DragInteraction | undefined {
    const line = this.getSelectedLine();
    const hit =
      line === undefined
        ? undefined
        : hitLineHandle(lineHandles(this.model.getSnapshot(), line), pos);
    if (line === undefined || hit === undefined) {
      return undefined;
    }
    return startDrag(this.handleTarget(line, hit), hit.point, pos);
  }

  private handleTarget(line: Line, hit: LineHandleHit): DragTarget {
    switch (hit.kind) {
      case "endpoint":
        return {
          kind: "endpoint",
          lineId: line.id,
          startPlayerId: line.startPlayerId,
          from: line.waypoints.at(-1) ?? this.model.getPlayer(line.startPlayerId).position,
        };
      case "waypoint":
      case "bend":
        return { kind: hit.kind, lineId: line.id, index: hit.index, waypoints: line.waypoints };
    }
  }

  /**
   * Clicks place points on press, so a release matters only for the press that started the
   * drawing: away from the start player it ends a straight line drawn in one drag.
   */
  private releaseDrawing(draw: DrawInteraction, pos: FieldPosition): void {
    if (!draw.pressing) {
      return;
    }
    this.notifier.batch(() => {
      const released = { ...draw, pressing: false };
      if (pointDistance(pos, draw.start) <= PLAYER_RADIUS_YARDS) {
        this.setInteraction(released);
        return;
      }
      this.setInteraction(addDraftPoint(released, this.placeDraftPoint(released, pos)));
      this.commitLine();
    });
  }

  private drawLinePointerDown(pos: FieldPosition, kind: LineKind): void {
    const interaction = this.interaction;
    if (interaction?.type === "draw-line") {
      // A new press means the one that started the drawing has ended, even if its release was lost.
      const next = { ...interaction, pressing: false };
      this.setInteraction(addDraftPoint(next, this.placeDraftPoint(next, pos)));
      return;
    }
    if (!isToolAvailable(kind, this.getViewState())) {
      return;
    }
    const data = this.model.getSnapshot();
    // Ignore an attempt to start anywhere other than on a player.
    const player = hitTestPlayer(data.players, pos);
    if (player === undefined) {
      return;
    }
    // Left selected, the panel and the handles would keep pointing at another element while the
    // new line is drawn, and a panel edit would change that element instead of the new line.
    this.setSelection(NO_SELECTION);
    this.setInteraction(startDrawing(player, kind));
  }

  private addPlayerAt(pos: FieldPosition): void {
    if (!isToolAvailable("add-player", this.getViewState())) {
      return;
    }
    const { players } = this.model.getSnapshot();
    const id = this.ids.next("player", new Set(players.map((p) => p.id)));
    this.commands.execute(
      new AddPlayerCommand({
        id,
        position: this.clampToField(pos),
        shape: DEFAULT_PLAYER_SHAPE,
        label: "",
      }),
    );
    this.setSelection({ kind: "player", id });
  }
}
