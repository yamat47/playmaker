import {
  type EditorTool,
  FIELD_ZONE_LABELS,
  type FieldZone,
  type LineInterpolation,
  type LineKind,
  type PlayerFill,
  type PlayerShape,
  type TeamSide,
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
  readonly tool: Readonly<Record<EditorTool, string>>;
  readonly undo: string;
  readonly redo: string;
  readonly delete: string;
  readonly finishLine: string;
  readonly cancel: string;
  readonly zone: Readonly<Record<FieldZone, string>>;
  readonly formation: string;
  readonly loadFormation: string;
  readonly side: Readonly<Record<TeamSide, string>>;
  readonly formationLimit: (maxPlayers: number) => string;
  readonly playerLimit: (maxPlayers: number) => string;
  readonly lineLimit: (maxLines: number) => string;
  readonly selectionHint: string;
  /** Shown in the panel while a line is drawn, in place of the selection hint. */
  readonly drawingHint: string;
  readonly player: string;
  readonly line: string;
  readonly label: string;
  readonly shape: string;
  readonly color: string;
  readonly kind: string;
  readonly interpolation: string;
  readonly width: string;
  readonly shapes: Readonly<Record<PlayerShape, string>>;
  readonly fills: Readonly<Record<PlayerFill, string>>;
  readonly kinds: Readonly<Record<LineKind, string>>;
  readonly interpolations: Readonly<Record<LineInterpolation, string>>;
  readonly colors: Readonly<Record<SwatchToken, string>>;
  /** Name of a player swatch, from the color name and the fill name. */
  readonly swatch: (color: string, fill: string) => string;
  readonly reset: string;
  /** Name of the button that clears a field back to the theme default. */
  readonly resetField: (field: string) => string;
}

export const en: Messages = {
  tool: { select: "Select", "add-player": "Add player", "draw-line": "Draw line" },
  undo: "Undo",
  redo: "Redo",
  delete: "Delete",
  finishLine: "Finish line",
  cancel: "Cancel",
  zone: FIELD_ZONE_LABELS,
  formation: "Formation",
  loadFormation: "Load formation…",
  side: { offense: "Offense", defense: "Defense" },
  formationLimit: (maxPlayers) =>
    `Formations that would put more than ${maxPlayers} players on the field cannot be loaded`,
  playerLimit: (maxPlayers) => `Up to ${maxPlayers} players`,
  lineLimit: (maxLines) => `Up to ${maxLines} lines`,
  selectionHint: "Select a player or a line to edit its properties",
  drawingHint:
    "Click to place a bend. Double-click or press Enter to finish the line, or press Esc to cancel it.",
  player: "Player",
  line: "Line",
  label: "Label",
  shape: "Shape",
  color: "Color",
  kind: "Kind",
  interpolation: "Interpolation",
  width: "Width",
  shapes: { circle: "Circle", square: "Square" },
  fills: { outline: "Outline", solid: "Solid" },
  kinds: { route: "Route", block: "Block", motion: "Motion" },
  interpolations: { straight: "Straight", bezier: "Curved" },
  colors: { swatch1: "Black", swatch2: "Red", swatch3: "Blue", swatch4: "Green" },
  swatch: (color, fill) => `${color} ${fill.toLowerCase()}`,
  reset: "Default",
  resetField: (field) => `Reset ${field.toLowerCase()} to default`,
};
