import { snapToGrid } from "../geometry/grid.js";
import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseBoundedArray,
} from "./guards.js";

/**
 * Shape of a player marker. Many shapes would clutter the diagram, so only circle and square.
 * Both can use the circumscribed circle as the hit area, so the hit test does not branch on shape.
 */
export const PLAYER_SHAPE_VALUES = ["circle", "square"] as const;

export type PlayerShape = (typeof PLAYER_SHAPE_VALUES)[number];

/** Default when no shape is given. */
export const DEFAULT_PLAYER_SHAPE: PlayerShape = "circle";

/**
 * Fill of a player marker: outline only (`outline`) or filled with the color (`solid`).
 * Held independently of the shape, it tells offense and defense or roles apart. The panel lists
 * its swatches in this order.
 */
export const PLAYER_FILL_VALUES = ["outline", "solid"] as const;

export type PlayerFill = (typeof PLAYER_FILL_VALUES)[number];

/** Default when no fill is given. Outline only, like a diagram drawn on a chalkboard. */
export const DEFAULT_PLAYER_FILL: PlayerFill = "outline";

/**
 * Limit on the players received from outside. A real play diagram has about 22, so it is never
 * reached. Normalization drops the excess so that broken or malicious data cannot stall rendering.
 */
export const MAX_PLAYERS = 64;

/**
 * Radius of a player marker (in yards). The drawn size and the hit test radius share this value.
 * The field uses one scale in both directions, so a circle in yards is a circle on screen too.
 */
export const PLAYER_RADIUS_YARDS = 0.93;

/**
 * Position on the field (in yards). The vertical value is the distance from the LOS
 * (`field.losYard`), so when switching zones moves the LOS, the diagram keeps its shape and
 * moves along with it.
 * - lateralYard: 0 = left sideline ... FIELD_WIDTH_YARDS = right sideline
 * - downfieldYard: 0 = LOS. Positive is the offense direction (screen top), negative the backfield
 *
 * Both are multiples of GRID_STEP_YARDS; the model holds no position off the grid.
 */
export interface FieldPosition {
  readonly lateralYard: number;
  readonly downfieldYard: number;
}

/**
 * A single player. `color` is a CSS color string; when omitted, the theme color is used.
 * When `fill` is omitted, DEFAULT_PLAYER_FILL is used.
 */
export interface Player {
  readonly id: string;
  readonly position: FieldPosition;
  readonly shape: PlayerShape;
  readonly label: string;
  readonly color?: string;
  readonly fill?: PlayerFill;
}

function isPlayerShape(value: unknown): value is PlayerShape {
  return isOneOf(value, PLAYER_SHAPE_VALUES);
}

function isPlayerFill(value: unknown): value is PlayerFill {
  return isOneOf(value, PLAYER_FILL_VALUES);
}

/**
 * Returns null when a coordinate is not a finite number, since it cannot be restored. The result
 * is not shared with the input. Values snap to grid points, so a position from outside lands on
 * the same grid as one set by dragging, and no position in the diagram is off the grid.
 */
export function parseFieldPosition(raw: unknown): FieldPosition | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { lateralYard, downfieldYard } = raw;
  if (!isFiniteNumber(lateralYard) || !isFiniteNumber(downfieldYard)) {
    return null;
  }
  return snapToGrid({ lateralYard, downfieldYard });
}

/**
 * Normalizes one entry received from outside into a Player. An entry whose position is not valid
 * coordinates returns null and is dropped. A missing shape, label, color, or fill is filled with
 * the default instead of dropping the entry, so data saved by an older version stays readable.
 */
function normalizePlayer(raw: unknown, index: number): Player | null {
  if (!isRecord(raw)) {
    return null;
  }
  const position = parseFieldPosition(raw.position);
  if (position === null) {
    return null;
  }

  // Without an id, assign one from the array position so the same data always yields the same id.
  const id = isNonEmptyString(raw.id) ? raw.id : `p${index}`;
  return {
    id,
    position,
    shape: isPlayerShape(raw.shape) ? raw.shape : DEFAULT_PLAYER_SHAPE,
    label: typeof raw.label === "string" ? raw.label : "",
    // exactOptionalPropertyTypes rejects undefined, so color and fill keys are set only if present.
    ...(isNonEmptyString(raw.color) ? { color: raw.color } : {}),
    ...(isPlayerFill(raw.fill) ? { fill: raw.fill } : {}),
  };
}

/**
 * Normalizes players received from outside into Player[]. Returns an empty array for a non-array.
 * Entries after the first MAX_PLAYERS are dropped unread.
 */
export function normalizePlayers(raw: unknown): Player[] {
  return parseBoundedArray(raw, MAX_PLAYERS, normalizePlayer);
}

/** Copies down to the position, sharing no references with the original player. */
export function clonePlayer(player: Player): Player {
  return {
    id: player.id,
    position: { ...player.position },
    shape: player.shape,
    label: player.label,
    ...(player.color === undefined ? {} : { color: player.color }),
    ...(player.fill === undefined ? {} : { fill: player.fill }),
  };
}
