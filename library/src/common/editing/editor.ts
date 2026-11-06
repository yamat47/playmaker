import type { Event } from "../base/event.js";
import type { LinePatch } from "../commands/line-commands.js";
import type { PlayerPatch } from "../commands/player-commands.js";
import type { Formation } from "../formations/formation.js";
import type { Line } from "../model/line.js";
import type { FieldZone, PlayData } from "../model/play-data.js";
import type { FieldPosition, Player } from "../model/player.js";

export const EDITOR_TOOL_VALUES = ["select", "add-player", "draw-line"] as const;

export type EditorTool = (typeof EDITOR_TOOL_VALUES)[number];

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
  switch (tool) {
    case "add-player":
      return state.remainingPlayerSlots > 0;
    case "draw-line":
      return state.canStartLine;
    case "select":
      return true;
  }
}

/**
 * False for a formation that would exceed the player limit, since none of its players are placed.
 */
export function canLoadFormation(formation: Formation, state: EditorViewState): boolean {
  return formation.players.length <= state.remainingPlayerSlots;
}

/** The play diagram to draw. The version is needed only when saving, so it is left out. */
export type SceneData = Omit<PlayData, "version">;

/** Where to draw the selection highlight and the handles (in yard space). */
export type EditorOverlay =
  | { readonly kind: "none" }
  | { readonly kind: "player"; readonly playerId: string }
  | {
      readonly kind: "line";
      readonly waypointHandles: readonly FieldPosition[];
      readonly endpointHandle: FieldPosition;
    };

export interface EditorViewState {
  readonly tool: EditorTool;
  readonly selection: EditorSelection;
  /** Also true while drawing, where Undo takes back the drawing rather than a committed edit. */
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly fieldZone: FieldZone;
  /** Whether a line is being drawn (waiting for commit or cancel). */
  readonly isDrawing: boolean;
  /** How many more players can be placed. An operation placing more than this does nothing. */
  readonly remainingPlayerSlots: number;
  /** Whether the line count is below the limit, so that a new line can be started. */
  readonly canStartLine: boolean;
}

/** The overlay is computed from the same in-progress state as the scene. */
export interface EditorFrame {
  /** The committed play diagram with the in-progress drag or drawing overlaid on it. */
  readonly scene: SceneData;
  readonly overlay: EditorOverlay;
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
  getViewState(): EditorViewState;
  /** Undefined when no player is selected or the target has disappeared. */
  getSelectedPlayer(): Player | undefined;
  /** Undefined when no line is selected or the target has disappeared. */
  getSelectedLine(): Line | undefined;
  getFrame(): EditorFrame;
}

/** Pointer operations (in yard space). */
export interface IEditorGestures {
  pointerDown(pos: FieldPosition): void;
  pointerMove(pos: FieldPosition): void;
  pointerUp(pos: FieldPosition): void;
}

/** Edits invoked from the toolbar, the panels, and keyboard input. */
export interface IEditorActions {
  setTool(tool: EditorTool): void;
  commitLine(): void;
  cancelInteraction(): void;
  /**
   * Backs out one level at a time: cancels a drag or drawing in progress, otherwise clears the
   * selection, otherwise returns to the select tool.
   */
  stepBack(): void;
  deleteSelection(): void;
  updateSelectedPlayer(patch: PlayerPatch): void;
  updateSelectedLine(patch: LinePatch): void;
  setFieldZone(zone: FieldZone): void;
  /**
   * Appends the players to the existing diagram and returns true once they are placed.
   * Does nothing and returns false when no player can be placed or the limit would be exceeded.
   */
  loadFormation(formation: Formation): boolean;
  /** While drawing, removes the last placed point and leaves the history untouched. */
  undo(): void;
  redo(): void;
}

/** The surface for UI such as a toolbar or a panel that reads the view and invokes edits. */
export type IEditorUi = IEditorActions & IEditorScene;

export interface IEditorController extends IEditorScene, IEditorGestures, IEditorActions {}
