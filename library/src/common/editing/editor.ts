import type { Event } from "../base/event.js";
import type { LinePatch } from "../commands/line-commands.js";
import type { PlayerPatch } from "../commands/player-commands.js";
import type { LineHandles } from "../geometry/hit-test.js";
import { isOneOf } from "../model/guards.js";
import { LINE_KIND_VALUES, type Line, type LineKind } from "../model/line.js";
import type { FieldZone, PlayData } from "../model/play-data.js";
import type { FieldPosition, Player } from "../model/player.js";

/**
 * The line tools are named after the kind of line they draw. Choosing the kind before drawing
 * saves changing it in the panel afterward, which is how a coach thinks: the blocks, then the
 * routes, then the motion.
 */
export const EDITOR_TOOL_VALUES = ["select", "add-player", ...LINE_KIND_VALUES] as const;

export type EditorTool = (typeof EDITOR_TOOL_VALUES)[number];

/** Whether the tool draws lines; the tool is then the kind of line it draws. */
export function isLineTool(tool: EditorTool): tool is LineKind {
  return isOneOf(tool, LINE_KIND_VALUES);
}

/**
 * A selection is a desired id; it is not cleared when the target disappears. Existence is
 * checked on read. Having nothing selected is expressed as `kind: "none"`, as in EditorOverlay.
 */
export type EditorSelection =
  | { readonly kind: "player"; readonly id: string }
  | { readonly kind: "line"; readonly id: string }
  | { readonly kind: "none" };

export const NO_SELECTION: EditorSelection = { kind: "none" };

export function isSameSelection(a: EditorSelection, b: EditorSelection): boolean {
  if (a.kind === "none" || b.kind === "none") {
    return a.kind === b.kind;
  }
  return a.kind === b.kind && a.id === b.id;
}

/** False when the count limit has been reached and the tool can place nothing. */
export function isToolAvailable(tool: EditorTool, state: EditorViewState): boolean {
  if (isLineTool(tool)) {
    return state.canStartLine;
  }
  return tool === "add-player" ? state.remainingPlayerSlots > 0 : true;
}

/** The play diagram to draw. The version is needed only when saving, so it is left out. */
export type SceneData = Omit<PlayData, "version">;

/** Where to draw the selection highlight and the handles (in yard space). */
export type EditorOverlay =
  | { readonly kind: "none" }
  | { readonly kind: "player"; readonly playerId: string }
  | ({
      readonly kind: "line";
      /** The waypoint last pressed, which Delete removes. Undefined when none is picked. */
      readonly pickedWaypoint: number | undefined;
    } & LineHandles);

export interface EditorViewState {
  readonly tool: EditorTool;
  readonly selection: EditorSelection;
  /**
   * Also true while drawing or typing a label, where Undo takes back the drawing or the typing
   * rather than a committed edit.
   */
  readonly canUndo: boolean;
  /** False while a label is typed: committing it is a new edit, after which nothing can be redone. */
  readonly canRedo: boolean;
  readonly fieldZone: FieldZone;
  /** Whether a line is being drawn (waiting for commit or cancel). */
  readonly isDrawing: boolean;
  /** Whether a label typed in the panel is waiting to be committed. */
  readonly isTypingLabel: boolean;
  /** How many more players can be placed. An operation placing more than this does nothing. */
  readonly remainingPlayerSlots: number;
  /** Whether the line count is below the limit, so that a new line can be started. */
  readonly canStartLine: boolean;
}

/**
 * The element a press at the pointer would act on, marked before the press. It has the shape of
 * a selection, and like one it names "nothing" with `kind: "none"`.
 */
export type EditorHover = EditorSelection;

/**
 * The pointer shape over the field, as a CSS cursor keyword. It tells what a press would do:
 * grab something, select a line, place or start something, or nothing at all.
 */
export type EditorCursor =
  | "default"
  | "pointer"
  | "grab"
  | "grabbing"
  | "crosshair"
  | "not-allowed";

/** The overlay is computed from the same in-progress state as the scene. */
export interface EditorFrame {
  /**
   * The committed play diagram with the in-progress drag or drawing, and a label being typed,
   * overlaid on it.
   */
  readonly scene: SceneData;
  readonly overlay: EditorOverlay;
  /** What a press at the pointer would act on. None while a drag or drawing is in progress. */
  readonly hover: EditorHover;
  readonly cursor: EditorCursor;
}

/** The read-only surface used to keep rendering and the UI in sync. */
export interface IEditorScene {
  /** Fires once per operation whenever the result of getFrame may have changed. */
  readonly onDidChangeScene: Event<void>;
  /**
   * Fires only when getViewState or the value of the selected player or line changes.
   * Does not fire for operations that change only the diagram, such as moving during a drag.
   */
  readonly onDidChangeViewState: Event<void>;
  /**
   * Fires when the keys are to go into the selected player's label: when a player is
   * double-clicked, and when typing starts with a player selected. It fires after the view state
   * notification, so the panel already shows the player.
   */
  readonly onDidRequestLabelEdit: Event<void>;
  getViewState(): EditorViewState;
  /** Undefined when no player is selected or the target has disappeared. */
  getSelectedPlayer(): Player | undefined;
  /** Undefined when no line is selected or the target has disappeared. */
  getSelectedLine(): Line | undefined;
  getFrame(): EditorFrame;
}

/** The modifier keys held during a pointer operation. */
export interface PointerModifiers {
  /** Option on a Mac. A dragged player moves without its lines while it is held. */
  readonly altKey: boolean;
}

export const NO_MODIFIERS: PointerModifiers = { altKey: false };

/** Pointer operations (in yard space). */
export interface IEditorGestures {
  pointerDown(pos: FieldPosition): void;
  /**
   * Also called at the last position when a modifier key changes during a press, so a drop
   * follows the keys held when it was last drawn.
   */
  pointerMove(pos: FieldPosition, modifiers?: PointerModifiers): void;
  pointerUp(pos: FieldPosition): void;
  /** The pointer left the field, so nothing is marked as under it. */
  pointerLeave(): void;
  /**
   * Finishes the line being drawn, removes the waypoint of the selected line under pos, or asks
   * for the label of the player under pos. The two presses of the double-click have already
   * arrived as pointerDown and pointerUp.
   */
  doubleClick(pos: FieldPosition): void;
}

/** Edits invoked from the toolbar, the panels, and keyboard input. */
export interface IEditorActions {
  setTool(tool: EditorTool): void;
  commitLine(): void;
  cancelInteraction(): void;
  /**
   * Backs out one level at a time: cancels a drag or drawing in progress, otherwise lets go of the
   * picked waypoint, otherwise clears the selection, otherwise returns to the select tool.
   */
  stepBack(): void;
  /** Removes the picked waypoint of the selected line if there is one, else the selection. */
  deleteSelection(): void;
  updateSelectedPlayer(patch: PlayerPatch): void;
  /**
   * Shows the selected player with this label without committing it. The label is committed as
   * one edit, however many previews came before, by updateSelectedPlayer, and before any other
   * edit, Undo, Redo, press, tool switch, or cancelInteraction.
   */
  previewLabel(label: string): void;
  /** Drops the label shown by previewLabel. */
  discardLabelDraft(): void;
  /** Asks for the selected player's label to be typed. Asks nothing when no player is selected. */
  requestLabelEdit(): void;
  updateSelectedLine(patch: LinePatch): void;
  setFieldZone(zone: FieldZone): void;
  /** Mirrors the whole diagram left to right as one edit. The selection stays. */
  flip(): void;
  /** While drawing, removes the last placed point and leaves the history untouched. */
  undo(): void;
  redo(): void;
}

/** The surface for UI such as a toolbar or a panel that reads the view and invokes edits. */
export type IEditorUi = IEditorActions & IEditorScene;

export interface IEditorController extends IEditorScene, IEditorGestures, IEditorActions {}
