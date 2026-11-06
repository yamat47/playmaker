import {
  type EditorTool,
  FIELD_ZONE_LABELS,
  type FieldZone,
  type LineInterpolation,
  type LineKind,
  type PlayerFill,
  type PlayerShape,
} from "../../common/index.js";
import type { SwatchToken } from "../theme/palette.js";

/** Languages the built-in UI ships. The host picks one at construction. */
export const PLAYMAKER_LOCALE_VALUES = ["en", "ja"] as const;

export type PlaymakerLocale = (typeof PLAYMAKER_LOCALE_VALUES)[number];

/**
 * Every string the toolbar and the property panel show. Sentences whose word order differs
 * between languages are functions, so each dictionary decides the order itself.
 */
export interface Messages {
  /** The line tools are named by `kinds`, after the kind of line they draw. */
  readonly tool: Readonly<Record<Exclude<EditorTool, LineKind>, string>>;
  readonly undo: string;
  readonly redo: string;
  readonly delete: string;
  readonly zone: Readonly<Record<FieldZone, string>>;
  readonly playerLimit: (maxPlayers: number) => string;
  readonly lineLimit: (maxLines: number) => string;
  readonly selectionHint: string;
  /** Shown in the panel while a line is drawn, in place of the selection hint. */
  readonly drawingHint: string;
  /** Shown in the panel when a line tool is chosen and nothing is selected. */
  readonly lineToolHint: string;
  /** Shown under the properties of a selected line. */
  readonly bendHint: string;
  /** The panel button that mirrors the whole play, shown when nothing is selected. */
  readonly flip: string;
  /** Gestures the toolbar does not show, listed in the panel when nothing is selected. */
  readonly tips: readonly string[];
  readonly player: string;
  readonly line: string;
  readonly label: string;
  readonly shape: string;
  readonly color: string;
  readonly kind: string;
  readonly interpolation: string;
  readonly shapes: Readonly<Record<PlayerShape, string>>;
  readonly fills: Readonly<Record<PlayerFill, string>>;
  readonly kinds: Readonly<Record<LineKind, string>>;
  readonly interpolations: Readonly<Record<LineInterpolation, string>>;
  readonly colors: Readonly<Record<SwatchToken, string>>;
  /** Name of the swatch that leaves the color to the theme. */
  readonly defaultColor: string;
  /** Name of a player swatch, from the color name and the fill name. */
  readonly swatch: (color: string, fill: string) => string;
}

export const en: Messages = {
  tool: { select: "Select", "add-player": "Add player" },
  undo: "Undo",
  redo: "Redo",
  delete: "Delete",
  zone: FIELD_ZONE_LABELS,
  playerLimit: (maxPlayers) => `Up to ${maxPlayers} players`,
  lineLimit: (maxLines) => `Up to ${maxLines} lines`,
  selectionHint: "Select a player or a line to edit its properties",
  drawingHint:
    "Click to place a bend. Double-click or press Enter to finish the line, or press Esc to cancel it.",
  lineToolHint:
    "Drag from a player to draw a straight line, or click a player and then click to place bends.",
  bendHint:
    "Drag a small hollow circle halfway along a segment to add a bend there. Double-click a square bend, or click it and press Delete, to remove it.",
  flip: "Flip left and right",
  tips: [
    "Drag a player to move it with its lines. Hold Option (Alt) to move it alone.",
    "Type with a player selected, or double-click it, to edit its label.",
    "Delete removes the selection. Esc cancels the line being drawn or clears the selection.",
  ],
  player: "Player",
  line: "Line",
  label: "Label",
  shape: "Shape",
  color: "Color",
  kind: "Kind",
  interpolation: "Path",
  shapes: { circle: "Circle", square: "Square" },
  fills: { outline: "Outline", solid: "Solid" },
  kinds: { route: "Route", block: "Block", motion: "Motion" },
  interpolations: { straight: "Straight", bezier: "Curved" },
  colors: { swatch2: "Red", swatch3: "Blue", swatch4: "Green" },
  defaultColor: "Default",
  swatch: (color, fill) => `${color} ${fill.toLowerCase()}`,
};
