import {
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  parseBoundedArray,
} from "./guards.js";
import { type FieldPosition, type Player, parseFieldPosition } from "./player.js";

/**
 * Kind of a line. Kinds are told apart by the end marker and the stroke style, not by color.
 * - `route`: the path of a receiver or runner. Drawn with an arrow at the end
 * - `block`: a blocking assignment. Same width as route, with a T bar at the end
 * - `motion`: a player's movement before the snap. Dashed, with an arrow at the end
 */
export const LINE_KIND_VALUES = ["route", "block", "motion"] as const;

export type LineKind = (typeof LINE_KIND_VALUES)[number];

/**
 * Interpolation of a line. Applies to every kind of line.
 * - `straight`: joins the control points with straight segments
 * - `bezier`: joins the control points with a smooth curve that passes through all of them
 */
export const LINE_INTERPOLATION_VALUES = ["straight", "bezier"] as const;

export type LineInterpolation = (typeof LINE_INTERPOLATION_VALUES)[number];

/** Default when no kind is given. */
export const DEFAULT_LINE_KIND: LineKind = "route";

/** Default when no interpolation is given. */
export const DEFAULT_LINE_INTERPOLATION: LineInterpolation = "straight";

/** Multiplier when no thickness is given. Draws at the default width of each kind as is. */
export const DEFAULT_LINE_THICKNESS = 1;

/**
 * Limits on the lines received from outside and on the waypoints per line. A real play diagram
 * has about 20 lines with a few waypoints each, so these limits are never reached. Normalization
 * drops the excess so that broken or malicious data cannot stall rendering.
 */
export const MAX_LINES = 128;
export const MAX_WAYPOINTS_PER_LINE = 32;

/**
 * A single line. The start is held as a player id rather than coordinates, so moving the player
 * carries the line's start along. Omitting `color` and `thickness` draws with the theme color
 * and the default width of the kind.
 */
export interface Line {
  readonly id: string;
  readonly kind: LineKind;
  /** Id of the player at the start. A reference to a missing player is dropped on restore. */
  readonly startPlayerId: string;
  /** Intermediate points between the start and the end (may be empty). */
  readonly waypoints: readonly FieldPosition[];
  /** End point (in yard space). */
  readonly end: FieldPosition;
  readonly interpolation: LineInterpolation;
  /** A CSS color string. */
  readonly color?: string;
  /** Multiplier on the default width of the kind. DEFAULT_LINE_THICKNESS when omitted. */
  readonly thickness?: number;
}

function isLineKind(value: unknown): value is LineKind {
  return isOneOf(value, LINE_KIND_VALUES);
}

function isLineInterpolation(value: unknown): value is LineInterpolation {
  return isOneOf(value, LINE_INTERPOLATION_VALUES);
}

/** Whether a value is accepted as a width multiplier. 0 or less hides the line and is rejected. */
export function isLineThickness(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/**
 * Normalizes one entry received from outside into a Line. A non-object, an entry whose start
 * player does not exist, or one whose end is not a position returns null and is dropped.
 * A missing kind, interpolation, or id is filled with the default instead of dropping the
 * entry, so that data saved by an older version stays readable.
 */
function normalizeLine(
  raw: unknown,
  index: number,
  validPlayerIds: ReadonlySet<string>,
): Line | null {
  if (!isRecord(raw)) {
    return null;
  }

  // A line without its start player can be neither drawn nor grabbed, so drop it.
  if (!isNonEmptyString(raw.startPlayerId) || !validPlayerIds.has(raw.startPlayerId)) {
    return null;
  }
  const end = parseFieldPosition(raw.end);
  if (end === null) {
    return null;
  }

  return {
    id: isNonEmptyString(raw.id) ? raw.id : `l${index}`,
    kind: isLineKind(raw.kind) ? raw.kind : DEFAULT_LINE_KIND,
    startPlayerId: raw.startPlayerId,
    // A non-numeric waypoint is dropped individually; the line itself is kept.
    waypoints: parseBoundedArray(raw.waypoints, MAX_WAYPOINTS_PER_LINE, parseFieldPosition),
    end,
    interpolation: isLineInterpolation(raw.interpolation)
      ? raw.interpolation
      : DEFAULT_LINE_INTERPOLATION,
    // exactOptionalPropertyTypes rejects undefined, so the key is set only when a value exists.
    ...(isNonEmptyString(raw.color) ? { color: raw.color } : {}),
    ...(isLineThickness(raw.thickness) ? { thickness: raw.thickness } : {}),
  };
}

/**
 * Normalizes lines received from outside into Line[]. Returns an empty array for a non-array.
 * Pass the ids of the already normalized players as `validPlayerIds`; a line starting at a
 * player not in that set is dropped. Entries after the first MAX_LINES are dropped unread.
 */
export function normalizeLines(raw: unknown, validPlayerIds: ReadonlySet<string>): Line[] {
  return parseBoundedArray(raw, MAX_LINES, (entry, index) =>
    normalizeLine(entry, index, validPlayerIds),
  );
}

/** Copies down to the waypoints and each position, sharing no references with the original line. */
export function cloneLine(line: Line): Line {
  return {
    id: line.id,
    kind: line.kind,
    startPlayerId: line.startPlayerId,
    waypoints: line.waypoints.map((p) => ({ ...p })),
    end: { ...line.end },
    interpolation: line.interpolation,
    ...(line.color === undefined ? {} : { color: line.color }),
    ...(line.thickness === undefined ? {} : { thickness: line.thickness }),
  };
}

/**
 * Builds the line's control point sequence [start player position, ...waypoints, end].
 * Returns undefined when the start player is not found.
 */
export function lineAnchorPoints(
  line: Line,
  playersById: ReadonlyMap<string, Player>,
): FieldPosition[] | undefined {
  const start = playersById.get(line.startPlayerId);
  if (start === undefined) {
    return undefined;
  }
  return [{ ...start.position }, ...line.waypoints.map((p) => ({ ...p })), { ...line.end }];
}

export function indexPlayersById(players: readonly Player[]): Map<string, Player> {
  const map = new Map<string, Player>();
  for (const player of players) {
    map.set(player.id, player);
  }
  return map;
}
