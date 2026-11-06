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
import type { IIdFactory } from "../model/id-factory.js";
import { DEFAULT_LINE_INTERPOLATION, type Line, type LineKind, MAX_LINES } from "../model/line.js";
import type { FieldZone } from "../model/play-data.js";
import type { IPlayModel } from "../model/play-model.js";
import {
  DEFAULT_PLAYER_SHAPE,
  type FieldPosition,
  MAX_PLAYERS,
  type Player,
} from "../model/player.js";
import {
  type EditorFrame,
  type EditorSelection,
  type EditorTool,
  type EditorViewState,
  type IEditorController,
  isSameSelection,
  isToolAvailable,
  NO_MODIFIERS,
  NO_SELECTION,
  type PointerModifiers,
} from "./editor.js";
import { EditorNotifier } from "./editor-notifier.js";
import {
  addDraftPoint,
  CLICK_SLOP_YARDS,
  type DragInteraction,
  type DragTarget,
  type DrawInteraction,
  draftToLine,
  dragPatch,
  dragPosition,
  type Interaction,
  isSamePosition,
  type LineStyle,
  type PlayerStyle,
  splitDraftPoints,
  startDrag,
  startDrawing,
} from "./interaction.js";
import { composePreview, computeOverlay, lineHandles } from "./preview.js";

/** A handle of the selected line, and the line. */
interface SelectedLineHandle {
  readonly line: Line;
  readonly hit: LineHandleHit;
}

/** What a press acts on. */
type PressTarget =
  | ({ readonly kind: "handle" } & SelectedLineHandle)
  | { readonly kind: "player"; readonly player: Player }
  | { readonly kind: "line"; readonly line: Line }
  | { readonly kind: "none" };

const NO_PRESS_TARGET: PressTarget = { kind: "none" };

function handleTarget(line: Line, hit: LineHandleHit): DragTarget {
  switch (hit.kind) {
    case "endpoint":
      return { kind: "endpoint", lineId: line.id };
    case "waypoint":
    case "insert":
      return { kind: hit.kind, lineId: line.id, index: hit.index, waypoints: line.waypoints };
  }
}

function dropCommand(drop: DragInteraction): ICommand {
  const patch = dragPatch(drop);
  return patch.kind === "player"
    ? new MovePlayerCommand(patch.move)
    : new UpdateLineCommand(patch.lineId, patch.patch);
}

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
  // Where the current press went down, and whether the last press traveled CLICK_SLOP_YARDS before
  // its release. A browser reports a double-click for a click followed by a quick drag too, and
  // that must not remove the bend the drag just moved.
  private pressOrigin: FieldPosition | undefined;
  private lastPressDragged = false;
  // The style of the player and of the line last styled in the panel, given to the next player
  // placed and the next line drawn, so a run of defenders or of curved routes is styled once.
  private playerStyle: PlayerStyle = { shape: DEFAULT_PLAYER_SHAPE };
  private lineStyle: LineStyle = { interpolation: DEFAULT_LINE_INTERPOLATION };

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
    this.pressOrigin = pos;
    this.notifier.batch(() => {
      this.setPickedWaypoint(undefined);
      const interaction = this.interaction;
      if (interaction?.type === "draw-line") {
        // A new press means the one that started the drawing has ended, even if its release was
        // lost.
        this.placePoint({ ...interaction, pressing: false }, pos);
        return;
      }
      const target = this.pressTargetAt(pos);
      switch (target.kind) {
        case "handle":
          this.grabHandle(target, pos);
          return;
        case "player":
          this.pressPlayer(target.player, pos);
          return;
        case "line":
          this.setSelection({ kind: "line", id: target.line.id });
          return;
        case "none":
          this.pressEmptySpace(pos);
          return;
      }
    });
  }

  pointerMove(pos: FieldPosition, modifiers: PointerModifiers = NO_MODIFIERS): void {
    const interaction = this.interaction;
    if (interaction === undefined) {
      return;
    }
    // A move that lands on the same grid point changes nothing on screen, so it is not redrawn.
    this.notifier.batch(() => {
      if (interaction.type === "draw-line") {
        const cursor = this.clampToField(pos);
        if (!isSamePosition(cursor, interaction.cursor)) {
          this.setInteraction({ ...interaction, cursor });
        }
        return;
      }
      const current = this.placeDragged(interaction, pos);
      const alone = modifiers.altKey;
      if (!isSamePosition(current, interaction.current) || alone !== interaction.alone) {
        this.setInteraction({ ...interaction, current, alone });
      }
    });
  }

  pointerUp(pos: FieldPosition): void {
    this.lastPressDragged =
      this.pressOrigin !== undefined && pointDistance(pos, this.pressOrigin) >= CLICK_SLOP_YARDS;
    const interaction = this.interaction;
    if (interaction?.type === "draw-line") {
      this.releaseDrawing(interaction, pos);
      return;
    }
    if (interaction === undefined) {
      return;
    }
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      const dropped = { ...interaction, current: this.placeDragged(interaction, pos) };
      // A drop where the target already is, after a click or a drag back to where it started,
      // does not change the diagram, so it is put into neither the history nor a notification.
      if (isSamePosition(dropped.current, interaction.origin)) {
        return;
      }
      this.commands.execute(dropCommand(dropped));
    });
  }

  cancelInteraction(): void {
    this.notifier.batch(() => this.setInteraction(undefined));
  }

  doubleClick(pos: FieldPosition): void {
    if (this.lastPressDragged) {
      return;
    }
    if (this.interaction?.type === "draw-line") {
      this.commitLine();
      return;
    }
    const handle = this.selectedLineHandleAt(pos);
    const hit = handle?.hit;
    if (handle !== undefined && hit?.kind === "waypoint") {
      this.notifier.batch(() => this.removeWaypoint(handle.line, hit.index));
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
    if ("shape" in patch || "color" in patch || "fill" in patch) {
      const { shape, color, fill } = this.model.getPlayer(player.id);
      this.playerStyle = {
        shape,
        ...(color === undefined ? {} : { color }),
        ...(fill === undefined ? {} : { fill }),
      };
    }
  }

  updateSelectedLine(patch: LinePatch): void {
    const line = this.getSelectedLine();
    if (line === undefined) {
      return;
    }
    this.notifier.batch(() => this.commands.execute(new UpdateLineCommand(line.id, patch)));
    if ("interpolation" in patch || "color" in patch) {
      const { interpolation, color } = this.model.getLine(line.id);
      this.lineStyle = { interpolation, ...(color === undefined ? {} : { color }) };
    }
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
      // The waypoints may differ afterward, and the index would then point at another waypoint.
      this.setPickedWaypoint(undefined);
      this.commands.undo();
    });
  }

  redo(): void {
    this.notifier.batch(() => {
      this.setInteraction(undefined);
      this.setPickedWaypoint(undefined);
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
   * Where the dragged target goes for the pointer at pos: into the window and onto the grid, or
   * nowhere until the pointer has traveled CLICK_SLOP_YARDS. A click on a target that sits off the
   * grid or outside the window then leaves it where it is.
   */
  private placeDragged(drag: DragInteraction, pos: FieldPosition): FieldPosition {
    const at = dragPosition(drag, pos);
    return pointDistance(at, drag.origin) < CLICK_SLOP_YARDS ? drag.origin : this.clampToField(at);
  }

  private placePoint(draw: DrawInteraction, pos: FieldPosition): void {
    this.setInteraction(addDraftPoint(draw, pos, this.clampToField(pos)));
  }

  private lineFromDraft(draw: DrawInteraction): Line | undefined {
    const split = splitDraftPoints(draw.points);
    if (split === undefined) {
      return undefined;
    }
    const id = this.ids.next("line", new Set(this.model.getSnapshot().lines.map((l) => l.id)));
    return draftToLine(draw, id, split);
  }

  /**
   * What a press at pos acts on with the current tool. The end and waypoint handles of the
   * selected line come first, so they can be moved even where they overlap a player or another
   * line. An insert handle gives way to a player, since it only offers a place for a new waypoint.
   * The add-player tool takes neither handles nor lines, so a player can be placed on a line.
   */
  private pressTargetAt(pos: FieldPosition): PressTarget {
    const { players, lines } = this.model.getSnapshot();
    const placesPlayers = this.tool === "add-player";
    const handle = placesPlayers ? undefined : this.selectedLineHandleAt(pos);
    if (handle !== undefined && handle.hit.kind !== "insert") {
      return { kind: "handle", ...handle };
    }
    const player = hitTestPlayer(players, pos);
    if (player !== undefined) {
      return { kind: "player", player };
    }
    if (handle !== undefined) {
      return { kind: "handle", ...handle };
    }
    const line = placesPlayers ? undefined : hitTestLine(lines, players, pos);
    return line === undefined ? NO_PRESS_TARGET : { kind: "line", line };
  }

  private selectedLineHandleAt(pos: FieldPosition): SelectedLineHandle | undefined {
    const line = this.getSelectedLine();
    const hit =
      line === undefined
        ? undefined
        : hitLineHandle(lineHandles(this.model.getSnapshot(), line), pos);
    return line === undefined || hit === undefined ? undefined : { line, hit };
  }

  private grabHandle({ line, hit }: SelectedLineHandle, pos: FieldPosition): void {
    this.setInteraction(startDrag(handleTarget(line, hit), hit.point, pos));
    if (hit.kind === "waypoint") {
      this.setPickedWaypoint(hit.index);
    }
  }

  /**
   * The select and add-player tools select the player and start dragging it; releasing without
   * moving is just a selection. A line tool starts a line from it.
   */
  private pressPlayer(player: Player, pos: FieldPosition): void {
    const tool = this.tool;
    switch (tool) {
      case "select":
      case "add-player":
        this.setSelection({ kind: "player", id: player.id });
        this.setInteraction(
          startDrag({ kind: "player", playerId: player.id }, player.position, pos),
        );
        return;
      case "route":
      case "block":
      case "motion":
        this.startLine(player, tool, pos);
        return;
    }
  }

  /** The add-player tool places a player there; every other tool clears the selection. */
  private pressEmptySpace(pos: FieldPosition): void {
    switch (this.tool) {
      case "add-player":
        this.addPlayerAt(pos);
        return;
      case "select":
      case "route":
      case "block":
      case "motion":
        this.setSelection(NO_SELECTION);
        return;
    }
  }

  private startLine(player: Player, kind: LineKind, pos: FieldPosition): void {
    if (!isToolAvailable(kind, this.getViewState())) {
      return;
    }
    // Left selected, the panel and the handles would keep pointing at another element while the
    // new line is drawn, and a panel edit would change that element instead of the new line.
    this.setSelection(NO_SELECTION);
    this.setInteraction(startDrawing(player, kind, this.lineStyle, pos));
  }

  /**
   * Clicks place points on press, so a release matters only for the press that started the
   * drawing: once the pointer has traveled CLICK_SLOP_YARDS, a release where a point can go ends a
   * straight line drawn in one drag. A release on the start player, or after a mere tremble,
   * leaves the drawing open for clicks.
   */
  private releaseDrawing(draw: DrawInteraction, pos: FieldPosition): void {
    if (!draw.pressing) {
      return;
    }
    this.notifier.batch(() => {
      const released = { ...draw, pressing: false };
      const placed = addDraftPoint(released, pos, this.clampToField(pos));
      if (pointDistance(pos, draw.pressedAt) < CLICK_SLOP_YARDS || placed.points.length === 0) {
        this.setInteraction(released);
        return;
      }
      this.setInteraction(placed);
      this.commitLine();
    });
  }

  private addPlayerAt(pos: FieldPosition): void {
    if (!isToolAvailable("add-player", this.getViewState())) {
      return;
    }
    const { players } = this.model.getSnapshot();
    const id = this.ids.next("player", new Set(players.map((p) => p.id)));
    this.commands.execute(
      new AddPlayerCommand({
        ...this.playerStyle,
        id,
        position: this.clampToField(pos),
        label: "",
      }),
    );
    this.setSelection({ kind: "player", id });
  }
}
